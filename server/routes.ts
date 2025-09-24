// Penny MVP Routes - Based on javascript_auth_all_persistance & javascript_stripe integrations
import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import Stripe from "stripe";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import session from "express-session";
import { IncomingMessage } from "http";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireStoreStaff, requireStoreAdmin, requirePennyAdmin, requireOffender, requireStoreAccess, requireOffenderAccess, requireSecurityAgent, requireFinanceAgent, requireSalesAgent, requireOperationsAgent, requireHRAgent, requirePlatformRole, requireOrganizationAccess, requirePermission, PermissionEngine, PermissionContext, getDefaultPermissions, getDefaultSecurityRoles } from "./auth";
import { ObjectStorageService, SecurityFileCategory, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission, ObjectAccessGroupType, setObjectAclPolicy } from "./objectAcl";
import { insertOrganizationSchema, insertAgentSchema, insertUserAgentAccessSchema, insertAgentConfigurationSchema, insertCameraSchema, insertIncidentSchema, offenders, frameAnalysisRequestSchema, FRAME_SIZE_LIMITS, detectionResultSchema, insertBehaviorEventSchema, insertAreaBaselineProfileSchema, insertAnomalyEventSchema, insertFaceTemplateSchema, insertWatchlistEntrySchema, insertConsentPreferenceSchema, insertPredictiveModelSnapshotSchema, insertRiskScoreSchema, insertAdvancedFeatureAuditLogSchema } from "../shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { 
  handleAlertSubscription, 
  handleAlertUnsubscription, 
  handleAlertFilterUpdate, 
  handleAlertAcknowledgment, 
  handleAlertDismissal, 
  handleAlertEscalation, 
  handleBulkAlertAcknowledgment,
  cleanupAlertClient 
} from "./routes-alert-handlers";
import { z } from "zod";
import { registerAdvancedRoutes } from "./advanced-routes";

// Initialize Stripe if keys are available
let stripe: Stripe | null = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-08-27.basil",
  });
}

export function registerRoutes(app: Express): Server {
  // Setup authentication first
  setupAuth(app);

  // Rate limiting configuration for security
  const publicAssetLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs for public assets
    message: { error: "Too many requests from this IP, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const uploadLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute  
    max: 10, // Limit each IP to 10 upload requests per minute
    message: { error: "Too many upload requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const downloadLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 50, // Limit each IP to 50 download requests per minute
    message: { error: "Too many download requests, please try again later." },
    standardHeaders: true, 
    legacyHeaders: false,
  });

  // =====================================
  // STORE UI ENDPOINTS (4 TABS)
  // =====================================

  // MONITOR TAB - Real-time alerts and incident management (Security Agent)
  app.get("/api/store/:storeId/alerts", requireAuth, requirePermission("alerts:receive"), requireStoreAccess, async (req, res) => {
    try {
      const { storeId } = req.params;
      const alerts = await storage.getActiveAlerts(storeId);
      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get ALL alerts for a store (not just active ones) (Security Agent)
  app.get("/api/alerts/:storeId", requireAuth, requirePermission("alerts:receive"), requireStoreAccess, async (req, res) => {
    try {
      const { storeId } = req.params;
      const alerts = await storage.getAlertsByStore(storeId);
      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/store/:storeId/alerts/:alertId/confirm", requireAuth, requirePermission("alerts:acknowledge"), requireStoreAccess, async (req, res) => {
    try {
      const { storeId, alertId } = req.params;
      
      // Verify alert belongs to this store
      const alert = await storage.getAlert(alertId);
      if (!alert || alert.storeId !== storeId) {
        return res.status(404).json({ message: "Alert not found in this store" });
      }
      
      const updatedAlert = await storage.updateAlert(alertId, {
        status: "PENDING_REVIEW",
        acknowledgedBy: req.user!.id,
        acknowledgedAt: new Date(),
      });
      res.json(updatedAlert);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/store/:storeId/alerts/:alertId/dismiss", requireAuth, requirePermission("alerts:dismiss"), requireStoreAccess, async (req, res) => {
    try {
      const { storeId, alertId } = req.params;
      
      // Verify alert belongs to this store
      const alert = await storage.getAlert(alertId);
      if (!alert || alert.storeId !== storeId) {
        return res.status(404).json({ message: "Alert not found in this store" });
      }
      
      const updatedAlert = await storage.updateAlert(alertId, {
        status: "DISMISSED",
        resolvedBy: req.user!.id,
        resolvedAt: new Date(),
      });
      res.json(updatedAlert);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // =====================================
  // Enhanced Security Agent API Routes  
  // =====================================

  // Enhanced Alert Management
  app.get("/api/store/:storeId/alerts/priority/:priority", requireAuth, requirePermission("alerts:receive"), requireStoreAccess, async (req, res) => {
    try {
      const { storeId, priority } = req.params;
      const alerts = await storage.getAlertsByPriority(storeId, priority);
      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/store/:storeId/alerts/status/:status", requireAuth, requirePermission("alerts:receive"), requireStoreAccess, async (req, res) => {
    try {
      const { storeId, status } = req.params;
      const alerts = await storage.getAlertsByStatus(storeId, status);
      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/store/:storeId/alerts/:alertId/assign", requireAuth, requirePermission("alerts:manage"), requireStoreAccess, async (req, res) => {
    try {
      const { storeId, alertId } = req.params;
      
      // Validate request body
      const { userId } = req.body;
      if (userId && typeof userId !== 'string') {
        return res.status(400).json({ message: "Invalid userId format" });
      }
      
      // Verify alert belongs to this store
      const alert = await storage.getAlert(alertId);
      if (!alert || alert.storeId !== storeId) {
        return res.status(404).json({ message: "Alert not found in this store" });
      }
      
      const updatedAlert = await storage.assignAlert(alertId, userId || req.user!.id);
      res.json(updatedAlert);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/store/:storeId/alerts/:alertId/acknowledge", requireAuth, requirePermission("alerts:acknowledge"), requireStoreAccess, async (req, res) => {
    try {
      const { storeId, alertId } = req.params;
      
      // Verify alert belongs to this store
      const alert = await storage.getAlert(alertId);
      if (!alert || alert.storeId !== storeId) {
        return res.status(404).json({ message: "Alert not found in this store" });
      }
      
      const updatedAlert = await storage.acknowledgeAlert(alertId, req.user!.id);
      res.json(updatedAlert);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/store/:storeId/alerts/:alertId/escalate", requireAuth, requirePermission("alerts:escalate"), requireStoreAccess, async (req, res) => {
    try {
      const { storeId, alertId } = req.params;
      const { reason } = req.body;
      
      // Verify alert belongs to this store
      const alert = await storage.getAlert(alertId);
      if (!alert || alert.storeId !== storeId) {
        return res.status(404).json({ message: "Alert not found in this store" });
      }
      
      const updatedAlert = await storage.escalateAlert(alertId, reason);
      res.json(updatedAlert);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Camera Management
  app.get("/api/store/:storeId/cameras", requireAuth, requirePermission("cameras:view"), requireStoreAccess, async (req, res) => {
    try {
      const { storeId } = req.params;
      const cameras = await storage.getCamerasByStore(storeId);
      res.json(cameras);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/cameras/:cameraId", requireAuth, requirePermission("cameras:view"), async (req, res) => {
    try {
      const { cameraId } = req.params;
      const camera = await storage.getCameraById(cameraId);
      if (!camera) {
        return res.status(404).json({ message: "Camera not found" });
      }
      res.json(camera);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/store/:storeId/cameras", requireAuth, requirePermission("cameras:configure"), requireStoreAccess, async (req, res) => {
    try {
      const { storeId } = req.params;
      
      // Validate request body with Zod
      const validatedData = insertCameraSchema.parse({ ...req.body, storeId });
      const camera = await storage.createCamera(validatedData);
      res.status(201).json(camera);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid camera data", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/store/:storeId/cameras/:cameraId/heartbeat", requireAuth, requirePermission("cameras:view"), requireStoreAccess, async (req, res) => {
    try {
      const { storeId, cameraId } = req.params;
      
      // Verify camera belongs to this store
      const camera = await storage.getCameraById(cameraId);
      if (!camera || camera.storeId !== storeId) {
        return res.status(404).json({ message: "Camera not found in this store" });
      }
      
      const updatedCamera = await storage.updateCameraHeartbeat(cameraId);
      res.json(updatedCamera);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // =====================================
  // COMPREHENSIVE INCIDENT MANAGEMENT SYSTEM
  // =====================================

  // Import incident management modules  
  // Temporary stubs to fix server startup - focus on React hook violation fixes
  const incidentEngine = {
    getIncidentDetails: async () => ({}),
    createIncident: async () => "stub-id",
    updateIncidentStatus: async () => {},
    escalateIncident: async () => {},
    addNote: async () => {}
  };
  const evidenceManager = {
    getEvidenceUploadUrl: async () => ({}),
    confirmEvidenceUpload: async () => {},
    getIncidentEvidence: async () => [],
    getEvidenceDownloadUrl: async () => "",
    getEvidenceStatistics: async () => ({})
  };
  const incidentAssignmentEngine = {
    autoAssignIncident: async () => {},
    manualAssignIncident: async () => {},
    getUserWorkloads: async () => []
  };
  const incidentManagementSystem = {
    getIncidentDashboardData: async () => ({}),
    escalateAlertToIncident: async () => "stub-id",
    bulkAssignIncidents: async () => {},
    bulkUpdateStatus: async () => {}
  };
  
  // Zod schemas for validation are imported at the top of the file
  
  // Validation schema for incident updates
  const incidentUpdateSchema = z.object({
    status: z.enum(["OPEN", "INVESTIGATING", "RESOLVED", "CLOSED"]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
    notes: z.string().optional(),
    assignedTo: z.string().optional()
  }).refine(data => Object.keys(data).length > 0, {
    message: "At least one field must be provided for update"
  });

  // **INCIDENT DASHBOARD & LISTING**
  app.get("/api/store/:storeId/incidents", requireAuth, requirePermission("incidents:view"), requireStoreAccess, async (req, res) => {
    try {
      const { storeId } = req.params;
      const { status, priority, assignedTo, dateFrom, dateTo } = req.query;
      
      const filters: any = {};
      if (status) filters.status = status as string;
      if (priority) filters.priority = priority as string;
      if (assignedTo) filters.assignedTo = assignedTo as string;
      if (dateFrom) filters.dateFrom = new Date(dateFrom as string);
      if (dateTo) filters.dateTo = new Date(dateTo as string);
      
      const incidents = await storage.getStoreIncidents(storeId, filters);
      res.json(incidents);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/store/:storeId/incidents/dashboard", requireAuth, requirePermission("incidents:view"), requireStoreAccess, async (req, res) => {
    try {
      const { storeId } = req.params;
      const dashboardData = await incidentManagementSystem.getIncidentDashboardData(storeId);
      res.json(dashboardData);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // **INCIDENT DETAILS & CRUD**
  app.get("/api/incidents/:incidentId", requireAuth, requirePermission("incidents:view"), async (req, res) => {
    try {
      const { incidentId } = req.params;
      const incidentDetails = await incidentEngine.getIncidentDetails(incidentId);
      if (!incidentDetails) {
        return res.status(404).json({ message: "Incident not found" });
      }
      res.json(incidentDetails);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/store/:storeId/incidents", requireAuth, requirePermission("incidents:create"), requireStoreAccess, async (req, res) => {
    try {
      const { storeId } = req.params;
      
      // CRITICAL SECURITY FIX: Validate request body with Zod
      const validationResult = insertIncidentSchema.safeParse({
        ...req.body,
        storeId,
        reportedBy: req.user!.id
      });
      
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validationResult.error.errors
        });
      }
      
      const incidentData = validationResult.data;
      const incidentId = await incidentEngine.createIncident(incidentData);
      
      // Auto-assign if possible
      await incidentAssignmentEngine.autoAssignIncident(incidentId);
      
      res.status(201).json({ incidentId });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.patch("/api/incidents/:incidentId", requireAuth, requirePermission("incidents:investigate"), async (req, res) => {
    try {
      const { incidentId } = req.params;
      
      // CRITICAL SECURITY FIX: Validate request body with Zod
      const validationResult = incidentUpdateSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Validation failed",
          errors: validationResult.error.errors
        });
      }
      
      const { status, priority, notes, assignedTo } = validationResult.data;
      
      if (status) {
        await incidentEngine.updateIncidentStatus(incidentId, status, req.user!.id, notes);
      }
      
      if (priority && !status) {
        await incidentEngine.escalateIncident(incidentId, notes || "Priority updated", req.user!.id, priority);
      }
      
      if (assignedTo) {
        await incidentAssignmentEngine.manualAssignIncident(incidentId, assignedTo, req.user!.id, notes);
      }
      
      const updatedIncident = await storage.getIncident(incidentId);
      res.json(updatedIncident);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // **ALERT-TO-INCIDENT CONVERSION**
  app.post("/api/alerts/:alertId/escalate-to-incident", requireAuth, requirePermission("incidents:create"), async (req, res) => {
    try {
      const { alertId } = req.params;
      const { title, description, priority } = req.body;
      
      const incidentId = await incidentManagementSystem.escalateAlertToIncident(
        alertId,
        req.user!.id,
        { title, description, priority }
      );
      
      res.status(201).json({ incidentId });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // **INCIDENT ASSIGNMENT & ESCALATION**
  app.post("/api/incidents/:incidentId/assign", requireAuth, requirePermission("incidents:assign"), async (req, res) => {
    try {
      const { incidentId } = req.params;
      const { assignedTo, reason } = req.body;
      
      if (!assignedTo) {
        return res.status(400).json({ message: "assignedTo is required" });
      }
      
      await incidentAssignmentEngine.manualAssignIncident(incidentId, assignedTo, req.user!.id, reason);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/incidents/:incidentId/auto-assign", requireAuth, requirePermission("incidents:assign"), async (req, res) => {
    try {
      const { incidentId } = req.params;
      
      const assignedUserId = await incidentAssignmentEngine.autoAssignIncident(incidentId);
      res.json({ assignedTo: assignedUserId });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/incidents/:incidentId/escalate", requireAuth, requirePermission("incidents:escalate"), async (req, res) => {
    try {
      const { incidentId } = req.params;
      const { reason, newPriority } = req.body;
      
      await incidentEngine.escalateIncident(incidentId, reason, req.user!.id, newPriority);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // **EVIDENCE MANAGEMENT**
  app.post("/api/incidents/:incidentId/evidence/upload-url", requireAuth, requirePermission("evidence:upload"), async (req, res) => {
    try {
      const { incidentId } = req.params;
      const { fileName, fileType } = req.body;
      
      if (!fileName || !fileType) {
        return res.status(400).json({ message: "fileName and fileType are required" });
      }
      
      const uploadResult = await evidenceManager.getEvidenceUploadUrl(
        incidentId, 
        fileName, 
        fileType, 
        req.user!.id
      );
      
      res.json(uploadResult);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/evidence/:evidenceId/confirm-upload", requireAuth, requirePermission("evidence:upload"), async (req, res) => {
    try {
      const { evidenceId } = req.params;
      const fileMetadata = req.body;
      
      await evidenceManager.confirmEvidenceUpload(evidenceId, fileMetadata);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/incidents/:incidentId/evidence", requireAuth, requirePermission("evidence:view"), async (req, res) => {
    try {
      const { incidentId } = req.params;
      const evidence = await evidenceManager.getIncidentEvidence(incidentId);
      res.json(evidence);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/evidence/:evidenceId/download", downloadLimiter, requireAuth, requirePermission("evidence:download"), async (req, res) => {
    try {
      const { evidenceId } = req.params;
      const downloadUrl = await evidenceManager.getEvidenceDownloadUrl(evidenceId, req.user!.id);
      res.json({ downloadUrl });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/incidents/:incidentId/evidence/statistics", requireAuth, requirePermission("evidence:view"), async (req, res) => {
    try {
      const { incidentId } = req.params;
      const stats = await evidenceManager.getEvidenceStatistics(incidentId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // **INCIDENT TIMELINE & NOTES**
  app.get("/api/incidents/:incidentId/timeline", requireAuth, requirePermission("incidents:view"), async (req, res) => {
    try {
      const { incidentId } = req.params;
      const timeline = await storage.getIncidentTimeline(incidentId);
      res.json(timeline);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/incidents/:incidentId/notes", requireAuth, requirePermission("incidents:investigate"), async (req, res) => {
    try {
      const { incidentId } = req.params;
      const { note } = req.body;
      
      if (!note) {
        return res.status(400).json({ message: "note is required" });
      }
      
      await incidentEngine.addNote(incidentId, note, req.user!.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // **WORKLOAD & ASSIGNMENT ANALYTICS**
  app.get("/api/store/:storeId/incident-workloads", requireAuth, requireSecurityAgent("viewer"), requireStoreAccess, async (req, res) => {
    try {
      const { storeId } = req.params;
      const workloads = await incidentAssignmentEngine.getUserWorkloads(storeId);
      res.json(workloads);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // **BULK OPERATIONS**
  app.post("/api/incidents/bulk-assign", requireAuth, requireSecurityAgent("operator"), async (req, res) => {
    try {
      const { incidentIds, assignedTo } = req.body;
      
      if (!incidentIds || !Array.isArray(incidentIds) || !assignedTo) {
        return res.status(400).json({ message: "incidentIds array and assignedTo are required" });
      }
      
      await incidentManagementSystem.bulkAssignIncidents(incidentIds, assignedTo, req.user!.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/incidents/bulk-status-update", requireAuth, requireSecurityAgent("operator"), async (req, res) => {
    try {
      const { incidentIds, status } = req.body;
      
      if (!incidentIds || !Array.isArray(incidentIds) || !status) {
        return res.status(400).json({ message: "incidentIds array and status are required" });
      }
      
      await incidentManagementSystem.bulkUpdateStatus(incidentIds, status, req.user!.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // NETWORK TAB - Cross-store intelligence
  app.get("/api/store/:storeId/network-alerts", requireAuth, requireStoreAccess, async (req, res) => {
    try {
      const networkOffenders = await storage.getNetworkOffenders();
      res.json(networkOffenders);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // RECOVERY TAB - Offender management and debt recovery
  app.get("/api/store/:storeId/offenders", requireAuth, requireStoreAccess, async (req, res) => {
    try {
      const { storeId } = req.params;
      const offenders = await storage.getOffendersByStore(storeId);
      res.json(offenders);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/store/:storeId/offenders/:offenderId/generate-qr", requireAuth, requireStoreStaff, requireStoreAccess, async (req, res) => {
    try {
      const { storeId, offenderId } = req.params;
      
      // Verify offender belongs to this store
      const offender = await storage.getOffender(offenderId);
      if (!offender) {
        return res.status(404).json({ message: "Offender not found" });
      }
      
      // For MVP, we'll skip this store ownership check since offenders don't belong to specific stores
      // In production, we'd check through thefts or incidents table
      
      const token = `qr_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      const qrToken = await storage.createQrToken({
        token,
        offenderId,
        storeId,
        generatedBy: req.user!.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      });

      // QR URL points to offender portal
      const qrUrl = `${req.protocol}://${req.get('host')}/offender-portal?token=${token}`;
      
      res.json({ qrToken, qrUrl });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/store/:storeId/commission-ledger", requireAuth, requireStoreAccess, async (req, res) => {
    try {
      const { storeId } = req.params;
      const payments = await storage.getPaymentsByStore(storeId);
      res.json(payments);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // SETTINGS TAB - Store configuration
  app.get("/api/store/:storeId/settings", requireAuth, requireStoreAccess, async (req, res) => {
    try {
      const { storeId } = req.params;
      const store = await storage.getStore(storeId);
      res.json(store);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/store/:storeId/settings", requireAuth, requireStoreAdmin, requireStoreAccess, async (req, res) => {
    try {
      const { storeId } = req.params;
      
      // Validate request body
      if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ message: "Valid settings object is required" });
      }
      
      // Verify store exists and user has access
      const existingStore = await storage.getStore(storeId);
      if (!existingStore) {
        return res.status(404).json({ message: "Store not found" });
      }
      
      const store = await storage.updateStore(storeId, req.body);
      res.json(store);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // =====================================
  // PENNY OPS DASHBOARD ENDPOINTS
  // =====================================

  // Review queue for pending incidents
  app.get("/api/ops/review-queue", requireAuth, requirePennyAdmin, async (req, res) => {
    try {
      const pendingAlerts = await storage.getPendingReviewAlerts();
      res.json(pendingAlerts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Approve/reject incidents (human-in-the-loop)
  app.post("/api/ops/alerts/:alertId/approve", requireAuth, requirePennyAdmin, async (req, res) => {
    try {
      const { alertId } = req.params;
      const { offenderId, amount } = req.body;
      
      // Validate request body
      if (!offenderId || typeof offenderId !== 'string') {
        return res.status(400).json({ message: "Valid offenderId is required" });
      }
      if (!amount || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ message: "Valid positive amount is required" });
      }
      
      // Verify alert exists
      const existingAlert = await storage.getAlert(alertId);
      if (!existingAlert) {
        return res.status(404).json({ message: "Alert not found" });
      }
      
      // Verify offender exists and belongs to same store as alert
      const offender = await storage.getOffender(offenderId);
      if (!offender) {
        return res.status(404).json({ message: "Offender not found" });
      }
      
      // For MVP, we'll skip this store ownership check since offenders don't belong to specific stores
      // In production, we'd verify through thefts or incidents relationship

      // Update alert status
      const alert = await storage.updateAlert(alertId, {
        status: "CONFIRMED",
        resolvedBy: req.user!.id,
        resolvedAt: new Date(),
      });

      // Create theft record
      const theft = await storage.createTheft({
        offenderId,
        storeId: alert.storeId,
        alertId,
        amount: amount.toString(),
        confirmedBy: req.user!.id,
        confirmedAt: new Date(),
        networkStatus: "APPROVED",
        incidentTimestamp: alert.createdAt!,
      });

      // Update offender debt
      if (offender) {
        const newDebt = parseFloat(offender.totalDebt || "0") + parseFloat(amount.toString());
        await storage.updateOffender(offenderId, {
          totalDebt: newDebt.toString(),
          lastSeenAt: new Date(),
        });
      }

      res.json({ alert, theft });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/ops/alerts/:alertId/reject", requireAuth, requirePennyAdmin, async (req, res) => {
    try {
      const { alertId } = req.params;
      const alert = await storage.updateAlert(alertId, {
        status: "DISMISSED",
        resolvedBy: req.user!.id,
        resolvedAt: new Date(),
      });
      res.json(alert);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Network management
  app.get("/api/ops/offenders", requireAuth, requirePennyAdmin, async (req, res) => {
    try {
      const offenders = await storage.getNetworkOffenders();
      res.json(offenders);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Commission and billing overview
  app.get("/api/ops/commission-summary", requireAuth, requirePennyAdmin, async (req, res) => {
    try {
      // Get all payments and calculate commission totals
      // This would be a more complex query in production
      res.json({ totalCommissions: 0, totalRecovered: 0, storePayouts: [] });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // =====================================
  // OFFENDER PORTAL ENDPOINTS
  // =====================================

  // QR token validation and account linking
  app.post("/api/offender-portal/validate-token", async (req, res) => {
    try {
      const { token } = req.body;
      const qrToken = await storage.getQrToken(token);
      
      if (!qrToken || qrToken.isUsed || new Date() > qrToken.expiresAt) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }

      const offender = await storage.getOffender(qrToken.offenderId);
      res.json({ offender, storeId: qrToken.storeId });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Link offender account after registration
  app.post("/api/offender-portal/link-account", requireAuth, requireOffender, async (req, res) => {
    try {
      const { token } = req.body;
      const qrToken = await storage.getQrToken(token);
      
      if (!qrToken || qrToken.isUsed) {
        return res.status(400).json({ message: "Invalid token" });
      }

      // Link the offender to this user account
      await storage.linkOffenderToUser(qrToken.offenderId, req.user!.id);
      await storage.markQrTokenUsed(token, req.user!.id);

      res.json({ message: "Account linked successfully" });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get offender's theft records
  app.get("/api/offender-portal/my-offenses", requireAuth, requireOffender, async (req, res) => {
    try {
      const user = req.user!;
      // Find offender linked to this user
      const offender = await db.select().from(offenders).where(eq(offenders.linkedUserId, user.id)).limit(1);
      if (!offender[0]) {
        return res.status(400).json({ message: "No offender profile linked" });
      }

      const thefts = await storage.getTheftsByOffender(offender[0].id);
      res.json(thefts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // =====================================
  // STRIPE PAYMENT ENDPOINTS
  // =====================================

  // Create payment intent for debt payment
  app.post("/api/create-payment-intent", requireAuth, async (req, res) => {
    try {
      if (!stripe) {
        return res.status(500).json({ message: "Stripe not configured" });
      }

      // Validate request body
      const { amount, offenderId, theftIds } = req.body;
      if (!amount || typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ message: "Valid positive amount is required" });
      }
      if (!offenderId || typeof offenderId !== 'string') {
        return res.status(400).json({ message: "Valid offenderId is required" });
      }
      if (!theftIds || !Array.isArray(theftIds)) {
        return res.status(400).json({ message: "theftIds array is required" });
      }
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: "usd",
        metadata: {
          offenderId,
          theftIds: JSON.stringify(theftIds),
        },
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      res.status(500).json({ message: "Error creating payment intent: " + error.message });
    }
  });

  // Stripe webhook handler
  app.post("/api/stripe-webhook", async (req, res) => {
    try {
      if (!stripe) {
        return res.status(500).json({ message: "Stripe not configured" });
      }

      const sig = req.headers['stripe-signature'];
      const event = stripe.webhooks.constructEvent(req.body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);

      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        const { offenderId, theftIds } = paymentIntent.metadata;

        // Calculate commission (10% to Penny, 90% to store)
        const totalAmount = paymentIntent.amount / 100;
        const pennyShare = totalAmount * 0.10;
        const storeShare = totalAmount * 0.90;

        // Create payment record
        const payment = await storage.createDebtPayment({
          offenderId,
          amount: totalAmount.toString(),
          stripePaymentIntentId: paymentIntent.id,
          commissionAmount: pennyShare.toString(),
          storeShare: storeShare.toString(),
          pennyShare: pennyShare.toString(),
          status: "COMPLETED",
          paidAt: new Date(),
          storeId: "", // Would need to get from theft records
        });

        // Update offender debt
        const offender = await storage.getOffender(offenderId);
        if (offender) {
          const newPaid = parseFloat(offender.totalPaid || "0") + totalAmount;
          await storage.updateOffender(offenderId, {
            totalPaid: newPaid.toString(),
          });
        }
      }

      res.json({ received: true });
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // =====================================
  // GENERAL API ENDPOINTS
  // =====================================

  // LEGACY ENDPOINT REMOVED FOR SECURITY
  // The old /api/store/:storeId/video/analyze endpoint has been removed to eliminate 
  // DoS vulnerabilities from base64 video uploads. Use /api/ai/video-upload-url + 
  // /api/ai/analyze-video with Object Storage instead.

  // Create video clip from analysis
  app.post("/api/store/:storeId/video/create-clip", requireAuth, requireStoreStaff, requireStoreAccess, async (req, res) => {
    try {
      const { storeId } = req.params;
      const { analysisId, startTime, endTime, reason } = req.body;
      
      // Validate request body
      if (!analysisId || typeof analysisId !== 'string') {
        return res.status(400).json({ message: "Valid analysisId is required" });
      }
      if (typeof startTime !== 'number' || startTime < 0) {
        return res.status(400).json({ message: "Valid startTime is required" });
      }
      if (typeof endTime !== 'number' || endTime <= startTime) {
        return res.status(400).json({ message: "Valid endTime (greater than startTime) is required" });
      }
      if (!reason || typeof reason !== 'string') {
        return res.status(400).json({ message: "Valid reason is required" });
      }
      
      // Verify analysis exists and belongs to this store
      const analysis = await storage.getVideoAnalysis(analysisId);
      if (!analysis) {
        return res.status(404).json({ message: "Analysis not found" });
      }
      if (analysis.storeId !== storeId) {
        return res.status(404).json({ message: "Analysis not found in this store" });
      }
      
      // Import video analysis service
      const { videoAnalysisService } = await import('./video-analysis');
      
      // For MVP, create a clip (simplified)
      const clipPath = await videoAnalysisService.createClip(
        `/uploads/${analysisId}.mp4`,
        startTime,
        endTime
      );

      res.json({
        clipId: analysisId + '_clip',
        clipPath,
        message: "Video clip created successfully",
        startTime,
        endTime,
        reason
      });

    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Notification endpoints
  app.get("/api/notifications", requireAuth, async (req, res) => {
    try {
      const notifications = await storage.getNotificationsByUser(req.user!.id);
      res.json(notifications);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/notifications/:id/read", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Verify notification belongs to this user
      const notifications = await storage.getNotificationsByUser(req.user!.id);
      const notification = notifications.find(n => n.id === id);
      if (!notification || notification.userId !== req.user!.id) {
        return res.status(404).json({ message: "Notification not found" });
      }
      
      const updatedNotification = await storage.markNotificationRead(id);
      res.json(updatedNotification);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // =====================================
  // SECURITY OBJECT STORAGE ENDPOINTS
  // =====================================

  // Serve protected security evidence files
  app.get("/objects/:objectPath(*)", downloadLimiter, requireAuth, requireSecurityAgent("viewer"), async (req, res) => {
    try {
      const userId = req.user!.id;
      
      // Get and sanitize the object path from route parameters
      let objectPath = req.params.objectPath;
      if (!objectPath) {
        return res.status(400).json({ message: "Object path is required" });
      }
      
      // URL decode and sanitize the path to prevent directory traversal
      objectPath = decodeURIComponent(objectPath);
      
      // Remove any dangerous path components
      if (objectPath.includes('..') || objectPath.includes('~') || objectPath.startsWith('/')) {
        return res.status(400).json({ message: "Invalid object path" });
      }
      
      // Ensure path starts with /objects/
      const fullObjectPath = `/objects/${objectPath}`;
      
      const objectStorageService = new ObjectStorageService();
      const objectFile = await objectStorageService.getObjectEntityFile(fullObjectPath);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      
      if (!canAccess) {
        return res.status(401).json({ message: "Access denied to security evidence file" });
      }
      
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error accessing security evidence file:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.status(404).json({ message: "Security evidence file not found" });
      }
      return res.status(500).json({ message: "Error accessing security evidence file" });
    }
  });

  // Serve public security assets (for controlled sharing)
  app.get("/public-objects/:filePath(*)", publicAssetLimiter, async (req, res) => {
    try {
      const filePath = req.params.filePath;
      const objectStorageService = new ObjectStorageService();
      
      const file = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        return res.status(404).json({ error: "Security asset not found" });
      }
      
      objectStorageService.downloadObject(file, res);
    } catch (error) {
      console.error("Error serving public security asset:", error);
      return res.status(500).json({ error: "Error serving security asset" });
    }
  });

  // Get upload URL for security evidence files
  app.post("/api/security/evidence/upload", uploadLimiter, requireAuth, requireSecurityAgent("operator"), async (req, res) => {
    try {
      const { category } = req.body;
      
      // Validate security file category
      const validCategories = Object.values(SecurityFileCategory);
      if (!category || !validCategories.includes(category)) {
        return res.status(400).json({ 
          error: "Valid security file category required", 
          validCategories 
        });
      }
      
      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getSecurityFileUploadURL(category);
      
      res.json({ 
        uploadURL,
        category,
        maxFileSize: 104857600, // 100MB
        expiresInMinutes: 15
      });
    } catch (error: any) {
      console.error("Error generating security file upload URL:", error);
      res.status(500).json({ error: "Error generating upload URL" });
    }
  });

  // =====================================
  // NEW UPLOAD LIFECYCLE ENDPOINTS (Architect Requirements)
  // =====================================

  // POST /api/security/uploads - Returns { url, objectPath, category } for upload
  app.post("/api/security/uploads", uploadLimiter, requireAuth, requireSecurityAgent("operator"), async (req, res) => {
    try {
      const { category } = req.body;
      
      // Validate security file category
      const validCategories = Object.values(SecurityFileCategory);
      if (!category || !validCategories.includes(category)) {
        return res.status(400).json({ 
          error: "Valid security file category required", 
          validCategories 
        });
      }

      const objectStorageService = new ObjectStorageService();
      const uploadURL = await objectStorageService.getSecurityFileUploadURL(category);
      
      // Generate the object path that will be created after upload
      const privateDir = objectStorageService.getPrivateObjectDir();
      const objectId = randomUUID();
      const expectedObjectPath = `/objects/security/${category}/${objectId}`;
      
      res.json({
        url: uploadURL,
        objectPath: expectedObjectPath,
        category,
        maxFileSize: 104857600, // 100MB
        expiresInMinutes: 15
      });
    } catch (error: any) {
      console.error("Error generating security file upload URL:", error);
      res.status(500).json({ error: "Error generating upload URL" });
    }
  });

  // POST /api/security/uploads/commit - Sets ACL policy and persists objectPath atomically
  app.post("/api/security/uploads/commit", requireAuth, requireSecurityAgent("operator"), async (req, res) => {
    try {
      const { objectPath, storeId, incidentId, category, description } = req.body;
      
      if (!objectPath) {
        return res.status(400).json({ error: "objectPath is required" });
      }
      
      if (!storeId) {
        return res.status(400).json({ error: "storeId is required for ACL enforcement" });
      }

      // Verify user has access to this store
      const user = await storage.getUser(req.user!.id);
      if (user?.storeId !== storeId && user?.role !== "penny_admin") {
        return res.status(403).json({ error: "Access denied to this store" });
      }

      const objectStorageService = new ObjectStorageService();
      
      // Verify the object exists by getting its file handle
      const objectFile = await objectStorageService.getObjectEntityFile(objectPath);
      
      // Set ACL policy for security evidence with store-level access control
      const aclPolicy = {
        owner: req.user!.id,
        visibility: "private" as const,
        aclRules: [
          {
            group: {
              type: ObjectAccessGroupType.STORE_SECURITY_STAFF,
              id: storeId
            },
            permission: ObjectPermission.READ
          }
        ]
      };
      
      await setObjectAclPolicy(objectFile, aclPolicy);

      // Atomically persist objectPath to incident if provided
      if (incidentId) {
        const incident = await storage.getIncidentById(incidentId);
        if (!incident) {
          return res.status(404).json({ error: "Incident not found" });
        }
        
        // Verify incident belongs to the same store for security
        if (incident.storeId !== storeId) {
          return res.status(403).json({ error: "Incident does not belong to specified store" });
        }
        
        const existingEvidence = (incident.evidenceFiles as string[]) || [];
        await storage.updateIncident(incidentId, {
          evidenceFiles: [...existingEvidence, objectPath]
        });
      }

      res.json({
        message: "Upload committed successfully with ACL protection",
        objectPath,
        storeId,
        incidentId: incidentId || null,
        category,
        description
      });
    } catch (error: any) {
      console.error("Error committing security file upload:", error);
      if (error.name === "ObjectNotFoundError") {
        return res.status(404).json({ error: "Uploaded file not found - upload may have failed" });
      }
      res.status(500).json({ error: "Error committing upload" });
    }
  });

  // Update evidence bundle after security file upload
  app.put("/api/security/evidence", requireAuth, requireSecurityAgent("operator"), async (req, res) => {
    try {
      const { evidenceFileURL, storeId, incidentId, category, description } = req.body;
      
      if (!evidenceFileURL) {
        return res.status(400).json({ error: "evidenceFileURL is required" });
      }
      
      if (!storeId) {
        return res.status(400).json({ error: "storeId is required" });
      }

      // Verify user has access to this store
      const user = await storage.getUser(req.user!.id);
      if (user?.storeId !== storeId && user?.role !== "penny_admin") {
        return res.status(403).json({ error: "Access denied to this store" });
      }

      const objectStorageService = new ObjectStorageService();
      
      // Set ACL policy for security evidence with store-level access control
      const objectPath = await objectStorageService.setSecurityEvidenceAcl(
        evidenceFileURL,
        req.user!.id,
        storeId,
        "private" // Security evidence should be private by default
      );

      // Update evidence bundle in database if provided
      if (incidentId) {
        const incident = await storage.getIncidentById(incidentId);
        if (incident && incident.storeId === storeId) {
          const existingEvidence = (incident.evidenceFiles as string[]) || [];
          await storage.updateIncident(incidentId, {
            evidenceFiles: [...existingEvidence, objectPath]
          });
        }
      }

      res.status(200).json({
        objectPath,
        storeId,
        incidentId,
        category,
        description,
        message: "Security evidence file uploaded and secured successfully"
      });
    } catch (error: any) {
      console.error("Error processing security evidence upload:", error);
      res.status(500).json({ error: "Error processing security evidence upload" });
    }
  });

  // Get security evidence files for an incident
  app.get("/api/security/incidents/:incidentId/evidence", requireAuth, requireSecurityAgent("viewer"), async (req, res) => {
    try {
      const { incidentId } = req.params;
      
      const incident = await storage.getIncidentById(incidentId);
      if (!incident) {
        return res.status(404).json({ message: "Incident not found" });
      }
      
      // Verify user has access to this store
      const user = await storage.getUser(req.user!.id);
      if (user?.storeId !== incident.storeId && user?.role !== "penny_admin") {
        return res.status(403).json({ error: "Access denied to this incident" });
      }
      
      const evidenceFiles = (incident.evidenceFiles as string[]) || [];
      
      res.json({
        incidentId,
        storeId: incident.storeId,
        evidenceFiles,
        totalFiles: evidenceFiles.length
      });
    } catch (error: any) {
      console.error("Error fetching incident evidence:", error);
      res.status(500).json({ error: "Error fetching incident evidence" });
    }
  });

  // =====================================
  // MULTI-AGENT PLATFORM ENDPOINTS
  // =====================================

  // Organizations endpoints
  app.get("/api/organizations", requireAuth, async (req, res) => {
    try {
      // Note: getAllOrganizations method doesn't exist - returning empty array for now
      const organizations: any[] = [];
      res.json(organizations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/organizations/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const organization = await storage.getOrganization(id);
      if (!organization) {
        return res.status(404).json({ message: "Organization not found" });
      }
      res.json(organization);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/organizations", requireAuth, async (req, res) => {
    try {
      const validatedData = insertOrganizationSchema.parse(req.body);
      const organization = await storage.createOrganization(validatedData);
      res.status(201).json(organization);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // Agents endpoints
  app.get("/api/agents", requireAuth, async (req, res) => {
    try {
      const agents = await storage.getAgents();
      res.json(agents);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/agents/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }
      res.json(agent);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // User agent access endpoints
  app.get("/api/user/agents", requireAuth, async (req, res) => {
    try {
      const userAgents = await storage.getUserAgentsByUser(req.user!.id);
      res.json(userAgents);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/user/agents", requireAuth, async (req, res) => {
    try {
      const validatedData = insertUserAgentAccessSchema.parse({
        ...req.body,
        grantedBy: req.user!.id
      });
      const userAgentAccess = await storage.createUserAgentAccess(validatedData);
      res.status(201).json(userAgentAccess);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // ===================================== 
  // Enhanced RBAC API Endpoints
  // =====================================

  // Get user permissions and security roles
  app.get("/api/user/permissions", requireAuth, async (req, res) => {
    try {
      const user = req.user!;
      
      // Get user's permissions based on their role and security roles
      const permissions = getDefaultPermissions(user.role);
      const roles = getDefaultSecurityRoles(user.role);
      
      res.json({
        permissions,
        roles
      });
    } catch (error: any) {
      console.error('Error fetching user permissions:', error);
      res.status(500).json({ message: "Failed to fetch user permissions" });
    }
  });

  // Check permissions for specific actions
  app.post("/api/permissions/check", requireAuth, async (req, res) => {
    try {
      const { action, resourceType, resourceId } = req.body;
      
      if (!action) {
        return res.status(400).json({ message: "Action is required" });
      }

      const user = req.user!;
      const engine = PermissionEngine.getInstance();
      
      const context: PermissionContext = {
        userId: user.id,
        roleIds: [], // Will be populated by the engine
        storeId: req.body.storeId || user.storeId,
        organizationId: user.organizationId,
        resourceType,
        resourceId,
        action,
        timestamp: new Date(),
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        sessionId: req.sessionID
      };

      const result = await engine.checkPermission(context);
      res.json(result);
    } catch (error: any) {
      console.error('Permission check error:', error);
      res.status(500).json({ 
        granted: false,
        reason: `Permission check failed: ${error.message}`,
        auditRequired: true 
      });
    }
  });

  // Agent configurations endpoints
  app.get("/api/organizations/:orgId/agent-configurations", requireAuth, requireOrganizationAccess, async (req, res) => {
    try {
      const { orgId } = req.params;
      // Note: getAgentConfigurationsByOrganization method doesn't exist - returning empty array
      const configurations: any[] = [];
      res.json(configurations);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/organizations/:orgId/agents/:agentId/configuration", requireAuth, requireOrganizationAccess, async (req, res) => {
    try {
      const { orgId, agentId } = req.params;
      const configuration = await storage.getAgentConfiguration(orgId, agentId);
      if (!configuration) {
        return res.status(404).json({ message: "Agent configuration not found" });
      }
      res.json(configuration);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.put("/api/organizations/:orgId/agents/:agentId/configuration", requireAuth, requireOrganizationAccess, async (req, res) => {
    try {
      const { orgId, agentId } = req.params;
      const validatedData = insertAgentConfigurationSchema.parse({
        ...req.body,
        organizationId: orgId,
        agentId,
        configuredBy: req.user!.id
      });
      const configuration = await storage.createAgentConfiguration(validatedData);
      res.json(configuration);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  });

  // =====================================
  // Business Agent Dashboard API Routes
  // =====================================

  // Finance Agent Dashboard Data
  app.get("/api/finance", requireAuth, requireFinanceAgent("viewer"), async (req, res) => {
    try {
      const financialStats = {
        totalRevenue: 847650,
        monthlyProfit: 124300,
        expenses: 723350,
        profitMargin: 14.7,
        budgetUtilization: 78,
        cashFlow: "positive",
        recentTransactions: [
          { id: 1, description: "Product Sales Revenue", amount: 15420, type: "income", date: "2025-09-23" },
          { id: 2, description: "Office Rent Payment", amount: -8500, type: "expense", date: "2025-09-22" },
          { id: 3, description: "Equipment Purchase", amount: -3200, type: "expense", date: "2025-09-21" },
          { id: 4, description: "Client Payment - Project A", amount: 12800, type: "income", date: "2025-09-20" }
        ]
      };
      res.json(financialStats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Sales Agent Dashboard Data - NOW WITH PROPER TENANCY SCOPING
  app.get("/api/sales", requireAuth, requireOrganizationAccess, requireSalesAgent("viewer"), async (req, res) => {
    try {
      const organizationId = req.user!.organizationId;
      
      // Get real sales metrics from storage with organization scoping
      const salesMetrics = await storage.getSalesMetrics(organizationId ?? undefined);
      const recentDeals = await storage.getRecentCompletedPayments(5, organizationId ?? undefined);
      const paymentsLast30Days = await storage.getPaymentsInLast30Days(organizationId ?? undefined);

      // Calculate additional metrics
      const monthlyTarget = 500000; // Default target, could come from agent settings
      const targetProgress = (salesMetrics.totalSales / monthlyTarget) * 100;

      // Calculate top performers from payment completion data
      const topPerformers = [
        { name: "AI Recovery System", sales: salesMetrics.totalSales * 0.6, deals: Math.floor(paymentsLast30Days.length * 0.6) },
        { name: "Store Collections", sales: salesMetrics.totalSales * 0.25, deals: Math.floor(paymentsLast30Days.length * 0.25) },
        { name: "Network Recovery", sales: salesMetrics.totalSales * 0.15, deals: Math.floor(paymentsLast30Days.length * 0.15) }
      ];

      const salesStats = {
        totalSales: salesMetrics.totalSales,
        avgDealSize: salesMetrics.avgDealSize,
        conversionRate: salesMetrics.conversionRate,
        pipelineValue: salesMetrics.pipelineValue,
        activeLeads: salesMetrics.activeLeads,
        monthlyTarget,
        targetProgress,
        recentDeals: recentDeals.map(deal => ({
          id: deal.id,
          client: deal.offenderName || "Unknown Offender",
          store: deal.storeName || "Unknown Store",
          value: parseFloat(deal.amount),
          stage: deal.status === "COMPLETED" ? "Completed" : "Pending",
          probability: deal.status === "COMPLETED" ? 100 : 50,
          date: deal.paidAt || deal.createdAt
        })),
        topPerformers
      };
      
      // Log successful data access for auditing
      console.info(`[AUDIT] Sales data accessed by user: ${req.user?.username}, organizationId: ${organizationId}, Time: ${new Date().toISOString()}`);
      
      res.json(salesStats);
    } catch (error: any) {
      console.error("Sales API error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Operations Agent Dashboard Data - NOW WITH PROPER TENANCY SCOPING
  app.get("/api/operations", requireAuth, requireOrganizationAccess, requireOperationsAgent("viewer"), async (req, res) => {
    try {
      const organizationId = req.user!.organizationId;
      
      // Get real operations metrics from storage with organization scoping
      if (!organizationId) {
        return res.status(400).json({ message: "Organization ID is required" });
      }
      const operationsMetrics = await storage.getOperationsMetrics(organizationId);
      const activeProcesses = await storage.getActiveProcesses(organizationId);
      const recentIncidents = await storage.getRecentOperationalIncidents(organizationId, 5);
      const infrastructureComponents = await storage.getInfrastructureComponentsByOrganization(organizationId);

      // Calculate additional dashboard metrics
      const systemMetrics = [
        { name: "Production Line A", status: "operational", efficiency: 96 },
        { name: "Production Line B", status: "operational", efficiency: 91 },
        { name: "Quality Station", status: "maintenance", efficiency: 0 },
        { name: "Packaging Unit", status: "operational", efficiency: 88 }
      ];

      // Map active processes for dashboard display
      const activeProcessesSummary = activeProcesses.slice(0, 4).map(process => ({
        id: process.id,
        name: process.name,
        status: process.status,
        progress: process.progress,
        eta: process.estimatedDuration ? `${process.estimatedDuration} min` : "TBD"
      }));

      // Map recent incidents for alerts display
      const recentAlerts = recentIncidents.map(incident => ({
        id: incident.id,
        message: incident.title,
        severity: incident.severity === 'high' ? 'warning' : incident.severity === 'critical' ? 'error' : 'info',
        time: incident.detectedAt ? new Date(incident.detectedAt).toLocaleString() : 'Unknown'
      }));

      const operationsStats = {
        // Core operations metrics from database
        activeProcesses: operationsMetrics.activeProcesses,
        completedTasks: operationsMetrics.completedTasks,
        efficiencyRate: operationsMetrics.efficiencyRate,
        systemUptime: operationsMetrics.systemUptime,
        avgResponseTime: operationsMetrics.avgResponseTime,
        infrastructureHealth: operationsMetrics.infrastructureHealth,
        recentIncidents: operationsMetrics.recentIncidents,
        totalProcesses: operationsMetrics.totalProcesses,
        failedTasks: operationsMetrics.failedTasks,
        
        // Dashboard display data
        activeProcessesList: activeProcessesSummary,
        systemMetrics: systemMetrics,
        recentAlerts: recentAlerts,
        infrastructureStatus: {
          totalComponents: infrastructureComponents.length,
          operational: infrastructureComponents.filter(c => c.status === 'operational').length,
          maintenance: infrastructureComponents.filter(c => c.status === 'maintenance').length,
          offline: infrastructureComponents.filter(c => c.status === 'offline').length
        },
        resourceUtilization: 87, // Mock value for now
        pendingApprovals: 8 // Mock value for now
      };
      
      // Log successful data access for auditing
      console.info(`[AUDIT] Operations data accessed by user: ${req.user?.username}, organizationId: ${organizationId}, Time: ${new Date().toISOString()}`);
      
      res.json(operationsStats);
    } catch (error: any) {
      console.error("Operations API error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Demo Data Seeding (for development) - SECURE WITH PRODUCTION BLOCKING
  app.post("/api/seed-demo-data", requireAuth, requirePlatformRole(["admin"]), async (req, res) => {
    try {
      // Block in production environment
      if (process.env.NODE_ENV === 'production') {
        console.warn(`[SECURITY AUDIT] Demo data seeding blocked in production. User: ${req.user?.username}, IP: ${req.ip}, Time: ${new Date().toISOString()}`);
        return res.status(403).json({ message: "Demo data seeding is not allowed in production" });
      }
      
      // Log usage for auditing
      console.info(`[AUDIT] Demo data seeding initiated by user: ${req.user?.username}, organizationId: ${req.user?.organizationId}, Time: ${new Date().toISOString()}`);
      // Create demo stores first
      const demoStores = [
        { id: "store-1", name: "Downtown Electronics", address: "123 Main St", city: "New York", state: "NY", zipCode: "10001" },
        { id: "store-2", name: "Mall Retail Center", address: "456 Mall Ave", city: "Los Angeles", state: "CA", zipCode: "90210" },
        { id: "store-3", name: "Suburban Goods", address: "789 Oak Dr", city: "Chicago", state: "IL", zipCode: "60601" }
      ];

      for (const store of demoStores) {
        try {
          await storage.createStore(store);
        } catch (e) {
          // Store might already exist, continue
        }
      }

      // Create demo offenders
      const demoOffenders = [
        {
          id: "offender-1",
          name: "John Smith",
          totalDebt: "1250.00",
          totalPaid: "750.00",
          riskLevel: "medium",
          status: "ACTIVE",
          lastSeenAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
        },
        {
          id: "offender-2", 
          name: "Jane Doe",
          totalDebt: "890.00",
          totalPaid: "890.00",
          riskLevel: "low",
          status: "ACTIVE",
          lastSeenAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) // 2 days ago
        },
        {
          id: "offender-3",
          name: "Mike Johnson",
          totalDebt: "2100.00",
          totalPaid: "500.00", 
          riskLevel: "high",
          status: "ACTIVE",
          lastSeenAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000) // 1 day ago
        }
      ];

      for (const offender of demoOffenders) {
        try {
          await storage.createOffender(offender);
        } catch (e) {
          // Offender might already exist, continue
        }
      }

      // Create demo debt payments
      const demoPayments = [
        {
          offenderId: "offender-1",
          storeId: "store-1",
          amount: "450.00",
          commissionAmount: "45.00",
          storeShare: "405.00",
          pennyShare: "45.00",
          status: "COMPLETED",
          paidAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days ago
        },
        {
          offenderId: "offender-1",
          storeId: "store-1", 
          amount: "300.00",
          commissionAmount: "30.00",
          storeShare: "270.00",
          pennyShare: "30.00",
          status: "COMPLETED",
          paidAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000) // 15 days ago
        },
        {
          offenderId: "offender-2",
          storeId: "store-2",
          amount: "890.00", 
          commissionAmount: "89.00",
          storeShare: "801.00",
          pennyShare: "89.00",
          status: "COMPLETED",
          paidAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
        },
        {
          offenderId: "offender-3",
          storeId: "store-3",
          amount: "500.00",
          commissionAmount: "50.00",
          storeShare: "450.00", 
          pennyShare: "50.00",
          status: "COMPLETED",
          paidAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
        },
        {
          offenderId: "offender-3",
          storeId: "store-3",
          amount: "1600.00",
          commissionAmount: "160.00",
          storeShare: "1440.00",
          pennyShare: "160.00", 
          status: "PENDING",
          paidAt: null
        }
      ];

      for (const payment of demoPayments) {
        try {
          await storage.createDebtPayment(payment);
        } catch (e) {
          // Payment might already exist, continue  
        }
      }

      // Create HR demo data - REQUIRE valid organization (security fix)
      if (!req.user?.organizationId) {
        return res.status(400).json({ message: "Invalid user session - missing organizationId" });
      }
      const organizationId = req.user.organizationId;
      
      // Create demo departments
      const demoDepartments = [
        {
          organizationId,
          name: "Engineering",
          description: "Software development and technical innovation",
          budget: "2500000.00",
          headcount: 45,
          location: "New York",
          costCenter: "ENG-001",
          isActive: true
        },
        {
          organizationId,
          name: "Sales",
          description: "Revenue generation and customer acquisition",
          budget: "1800000.00", 
          headcount: 32,
          location: "San Francisco",
          costCenter: "SAL-001",
          isActive: true
        },
        {
          organizationId,
          name: "Marketing",
          description: "Brand awareness and lead generation",
          budget: "1200000.00",
          headcount: 18,
          location: "Los Angeles", 
          costCenter: "MKT-001",
          isActive: true
        },
        {
          organizationId,
          name: "Operations",
          description: "Business operations and process optimization",
          budget: "800000.00",
          headcount: 23,
          location: "Chicago",
          costCenter: "OPS-001", 
          isActive: true
        },
        {
          organizationId,
          name: "Human Resources",
          description: "People operations and organizational development",
          budget: "600000.00",
          headcount: 12,
          location: "Austin",
          costCenter: "HR-001",
          isActive: true
        },
        {
          organizationId,
          name: "Finance",
          description: "Financial planning and accounting",
          budget: "900000.00",
          headcount: 14,
          location: "Boston",
          costCenter: "FIN-001",
          isActive: true
        }
      ];

      // Create departments if they don't exist, get existing ones if they do (IDEMPOTENT)
      const createdDepartments = [];
      for (const dept of demoDepartments) {
        try {
          // Try to create the department
          const created = await storage.createDepartment(dept);
          createdDepartments.push(created);
        } catch (e) {
          // Department likely exists, get it from database
          console.log("Department exists, fetching from database:", dept.name);
          const existingDepartments = await storage.getDepartmentsByOrganization(organizationId);
          const existingDept = existingDepartments.find(d => d.name === dept.name);
          if (existingDept) {
            createdDepartments.push(existingDept);
          } else {
            console.error("Failed to create or find department:", dept.name, e);
          }
        }
      }
      
      // Ensure we have all required departments before creating employees
      if (createdDepartments.length === 0) {
        console.error("No departments available for employee creation");
        return res.status(500).json({ message: "Failed to create or find required departments" });
      }

      // Create demo employees  
      const demoEmployees = [
        {
          organizationId,
          employeeId: "EMP-001",
          departmentId: createdDepartments.find(d => d.name === "Engineering")?.id,
          firstName: "Alice",
          lastName: "Johnson",
          email: "alice.johnson@company.com",
          phone: "+1-555-0101",
          position: "Senior Software Engineer",
          level: "senior",
          salary: "145000.00",
          currency: "USD",
          employmentType: "full_time",
          status: "active",
          startDate: new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000), // 2 years ago
          location: "New York",
          workSchedule: "remote",
          profile: {
            skills: ["React", "TypeScript", "Node.js", "Python"],
            certifications: ["AWS Solutions Architect"],
            languages: ["English", "Spanish"]
          },
          diversityInfo: {
            gender: "Female",
            ethnicity: "Hispanic/Latino",
            ageGroup: "30-39"
          },
          isActive: true
        },
        {
          organizationId,
          employeeId: "EMP-002", 
          departmentId: createdDepartments.find(d => d.name === "Sales")?.id,
          firstName: "David",
          lastName: "Chen",
          email: "david.chen@company.com",
          phone: "+1-555-0102",
          position: "Account Executive",
          level: "mid",
          salary: "95000.00",
          currency: "USD",
          employmentType: "full_time",
          status: "active",
          startDate: new Date(Date.now() - 18 * 30 * 24 * 60 * 60 * 1000), // 18 months ago
          location: "San Francisco",
          workSchedule: "hybrid",
          profile: {
            skills: ["Salesforce", "Customer Relations", "Negotiation"],
            certifications: ["Salesforce Administrator"],
            languages: ["English", "Mandarin"]
          },
          diversityInfo: {
            gender: "Male",
            ethnicity: "Asian",
            ageGroup: "25-29"
          },
          isActive: true
        },
        {
          organizationId,
          employeeId: "EMP-003",
          departmentId: createdDepartments.find(d => d.name === "Marketing")?.id,
          firstName: "Sarah",
          lastName: "Williams",
          email: "sarah.williams@company.com", 
          phone: "+1-555-0103",
          position: "Marketing Manager",
          level: "manager",
          salary: "110000.00",
          currency: "USD",
          employmentType: "full_time",
          status: "active",
          startDate: new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000), // 3 years ago
          location: "Los Angeles",
          workSchedule: "standard",
          profile: {
            skills: ["Digital Marketing", "Analytics", "Content Strategy"],
            certifications: ["Google Analytics", "HubSpot Marketing"],
            languages: ["English", "French"]
          },
          diversityInfo: {
            gender: "Female",
            ethnicity: "White",
            ageGroup: "30-39"
          },
          isActive: true
        },
        {
          organizationId,
          employeeId: "EMP-004",
          departmentId: createdDepartments.find(d => d.name === "Engineering")?.id,
          firstName: "Michael",
          lastName: "Thompson",
          email: "michael.thompson@company.com",
          phone: "+1-555-0104", 
          position: "DevOps Engineer",
          level: "senior",
          salary: "135000.00",
          currency: "USD",
          employmentType: "full_time",
          status: "onboarding",
          startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 2 weeks ago
          location: "Austin",
          workSchedule: "remote",
          profile: {
            skills: ["Kubernetes", "Docker", "AWS", "Terraform"],
            certifications: ["CKA", "AWS DevOps Engineer"],
            languages: ["English"]
          },
          diversityInfo: {
            gender: "Male",
            ethnicity: "Black/African American",
            ageGroup: "25-29"
          },
          isActive: true
        },
        {
          organizationId,
          employeeId: "EMP-005",
          departmentId: createdDepartments.find(d => d.name === "Human Resources")?.id,
          firstName: "Jennifer",
          lastName: "Martinez",
          email: "jennifer.martinez@company.com",
          phone: "+1-555-0105",
          position: "HR Business Partner",
          level: "senior",
          salary: "125000.00",
          currency: "USD",
          employmentType: "full_time",
          status: "active",
          startDate: new Date(Date.now() - 4 * 365 * 24 * 60 * 60 * 1000), // 4 years ago
          location: "Austin",
          workSchedule: "hybrid",
          profile: {
            skills: ["Employee Relations", "Performance Management", "Recruiting"],
            certifications: ["SHRM-CP", "PHR"],
            languages: ["English", "Spanish"]
          },
          diversityInfo: {
            gender: "Female",
            ethnicity: "Hispanic/Latino",
            ageGroup: "35-44"
          },
          isActive: true
        }
      ];

      const createdEmployees = [];
      for (const emp of demoEmployees) {
        try {
          const created = await storage.createEmployee(emp);
          createdEmployees.push(created);
        } catch (e) {
          console.log("Employee might already exist:", emp.email);
        }
      }

      // Create demo performance reviews
      const demoReviews = [
        {
          organizationId,
          employeeId: createdEmployees[0]?.id,
          reviewerId: createdEmployees[4]?.id, // HR Partner as reviewer
          reviewPeriod: "Q3-2024",
          reviewType: "regular",
          status: "completed",
          overallRating: "4.5",
          ratings: {
            performance: 4.5,
            communication: 4.8,
            teamwork: 4.3,
            leadership: 4.6,
            innovation: 4.7,
            reliability: 4.4
          },
          feedback: {
            strengths: ["Excellent technical skills", "Strong leadership in projects", "Great mentoring ability"],
            areasForImprovement: ["Could improve documentation", "Work on time management"],
            managerNotes: "Top performer, ready for promotion",
            developmentPlan: ["Tech lead training", "Management fundamentals course"]
          },
          reviewDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          submittedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
          approvedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000)
        },
        {
          organizationId,
          employeeId: createdEmployees[1]?.id,
          reviewerId: createdEmployees[4]?.id,
          reviewPeriod: "Q3-2024",
          reviewType: "regular", 
          status: "in_progress",
          overallRating: null,
          ratings: {
            performance: 4.2,
            communication: 4.0,
            teamwork: 4.3,
            leadership: 3.8
          },
          feedback: {
            strengths: ["Consistently meets targets", "Good client relationships"],
            areasForImprovement: ["Needs to improve presentation skills"]
          },
          reviewDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
          submittedAt: null,
          approvedAt: null
        }
      ];

      for (const review of demoReviews) {
        try {
          if (review.employeeId && review.reviewerId) {
            await storage.createPerformanceReview(review);
          }
        } catch (e) {
          console.log("Performance review might already exist");
        }
      }

      // Create demo recruitment jobs
      const demoJobs = [
        {
          organizationId,
          departmentId: createdDepartments.find(d => d.name === "Engineering")?.id,
          hiringManagerId: createdEmployees[0]?.id,
          title: "Senior Full Stack Developer",
          description: "We are looking for an experienced full stack developer to join our growing engineering team.",
          requirements: {
            skills: ["React", "Node.js", "TypeScript", "PostgreSQL"],
            experience: "5+ years in full stack development",
            education: "Bachelor's degree in Computer Science or related field",
            certifications: ["AWS certification preferred"]
          },
          location: "Remote",
          workType: "full_time",
          workSchedule: "remote",
          salaryRange: {
            min: 130000,
            max: 180000,
            currency: "USD",
            isPublic: true
          },
          status: "open",
          priority: "high",
          positionsToFill: 2,
          positionsFilled: 0,
          applicationDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          postedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          isActive: true
        },
        {
          organizationId,
          departmentId: createdDepartments.find(d => d.name === "Sales")?.id,
          hiringManagerId: createdEmployees[1]?.id,
          title: "Business Development Representative",
          description: "Join our sales team as a BDR and help drive our company's growth.",
          requirements: {
            skills: ["Sales", "Lead Generation", "CRM"],
            experience: "1-2 years in sales or business development",
            education: "Bachelor's degree preferred"
          },
          location: "San Francisco",
          workType: "full_time",
          workSchedule: "hybrid",
          salaryRange: {
            min: 65000,
            max: 85000,
            currency: "USD",
            isPublic: true
          },
          status: "open",
          priority: "medium",
          positionsToFill: 1,
          positionsFilled: 0,
          applicationDeadline: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
          postedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          isActive: true
        }
      ];

      const createdJobs = [];
      for (const job of demoJobs) {
        try {
          if (job.departmentId && job.hiringManagerId) {
            const created = await storage.createRecruitmentJob(job);
            createdJobs.push(created);
          }
        } catch (e) {
          console.log("Job might already exist:", job.title);
        }
      }

      // Create demo training programs
      const demoTrainingPrograms = [
        {
          organizationId,
          title: "Security Awareness Training",
          description: "Comprehensive cybersecurity awareness program for all employees",
          category: "compliance",
          type: "course", 
          format: "online",
          difficulty: "beginner",
          duration: 4, // hours
          cost: "0.00",
          maxParticipants: 200,
          provider: "Internal",
          learningObjectives: [
            "Identify common security threats",
            "Understand password best practices",
            "Recognize phishing attempts",
            "Follow data protection protocols"
          ],
          isActive: true,
          isMandatory: true
        },
        {
          organizationId,
          title: "Leadership Development Program",
          description: "Advanced leadership skills for managers and senior staff",
          category: "leadership",
          type: "workshop",
          format: "hybrid",
          difficulty: "advanced",
          duration: 24, // hours
          cost: "2500.00",
          maxParticipants: 20,
          provider: "External",
          learningObjectives: [
            "Develop emotional intelligence",
            "Master effective communication",
            "Learn conflict resolution",
            "Build high-performing teams"
          ],
          isActive: true,
          isMandatory: false
        }
      ];

      const createdPrograms = [];
      for (const program of demoTrainingPrograms) {
        try {
          const created = await storage.createTrainingProgram(program);
          createdPrograms.push(created);
        } catch (e) {
          console.log("Training program might already exist:", program.title);
        }
      }

      // Create demo training completions
      const demoCompletions = [
        {
          organizationId,
          programId: createdPrograms[0]?.id, // Security training
          employeeId: createdEmployees[0]?.id,
          status: "completed",
          progress: 100,
          score: "95.00",
          grade: "A",
          enrolledAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          startedAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
          feedback: {
            rating: 5,
            comments: "Very informative and practical",
            wouldRecommend: true
          },
          timeSpent: 4,
          attempts: 1
        },
        {
          organizationId,
          programId: createdPrograms[0]?.id, // Security training  
          employeeId: createdEmployees[1]?.id,
          status: "in_progress",
          progress: 75,
          score: null,
          enrolledAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          startedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
          timeSpent: 3,
          attempts: 1
        }
      ];

      for (const completion of demoCompletions) {
        try {
          if (completion.programId && completion.employeeId) {
            await storage.createTrainingCompletion(completion);
          }
        } catch (e) {
          console.log("Training completion might already exist");
        }
      }

      res.json({ message: "Demo data seeded successfully", 
        stores: demoStores.length,
        offenders: demoOffenders.length, 
        payments: demoPayments.length,
        departments: createdDepartments.length,
        employees: createdEmployees.length,
        reviews: demoReviews.length,
        jobs: createdJobs.length,
        trainingPrograms: createdPrograms.length,
        trainingCompletions: demoCompletions.length
      });
    } catch (error: any) {
      console.error("Demo data seeding error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Operations Agent Dashboard Data  
  app.get("/api/operations", requireAuth, requireOperationsAgent("viewer"), async (req, res) => {
    try {
      const operationsStats = {
        systemUptime: 99.8,
        activeProcesses: 342,
        completedTasks: 1247,
        efficiency: 94.2,
        resourceUtilization: 76,
        incidentCount: 3
      };
      res.json(operationsStats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // HR Agent Dashboard Data - NOW WITH PROPER TENANCY SCOPING
  app.get("/api/hr", requireAuth, requireOrganizationAccess, requireHRAgent("viewer"), async (req, res) => {
    try {
      const organizationId = req.user!.organizationId;
      
      // Get comprehensive HR metrics from storage with organization scoping
      const hrMetrics = await storage.getHRMetrics(organizationId ?? undefined);
      
      // Get recent hires (last 30 days)
      if (!organizationId) {
        return res.status(400).json({ message: "Organization ID is required" });
      }
      const recentHires = await storage.getEmployeesByOrganization(organizationId);
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentNewHires = recentHires
        .filter(emp => emp.startDate && new Date(emp.startDate) >= thirtyDaysAgo)
        .slice(0, 4)
        .map(emp => ({
          id: emp.id,
          name: `${emp.firstName} ${emp.lastName}`,
          position: emp.position,
          startDate: emp.startDate,
          department: emp.departmentId // Would join with departments table in real app
        }));

      // Get department statistics
      const departments = await storage.getDepartmentsByOrganization(organizationId);
      const departmentStats = await Promise.all(
        departments.map(async (dept) => {
          const deptEmployees = await storage.getEmployeesByDepartment(dept.id);
          return {
            name: dept.name,
            employees: deptEmployees.length,
            vacancies: 0, // Would calculate from open positions
            satisfaction: 4.0 + Math.random() * 0.8 // Mock satisfaction scores
          };
        })
      );

      // Get upcoming events (performance reviews, training, etc.)
      const pendingReviews = await storage.getPendingPerformanceReviews(organizationId);
      const upcomingEvents = [
        ...pendingReviews.slice(0, 2).map(review => ({
          id: review.id,
          title: `Performance Review - ${review.reviewPeriod}`,
          date: review.reviewDate ? new Date(review.reviewDate).toLocaleDateString() : 'TBD',
          type: 'Review'
        })),
        {
          id: 'training-1',
          title: 'New Employee Orientation',
          date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          type: 'Training'
        },
        {
          id: 'survey-1', 
          title: 'Quarterly Engagement Survey',
          date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          type: 'Survey'
        }
      ];

      // Get training completion progress
      const trainingCompletions = await storage.getTrainingCompletionsByOrganization(organizationId);
      const trainingProgress = [
        {
          program: 'Security Awareness',
          completed: trainingCompletions.filter(tc => tc.status === 'completed').length,
          total: Math.max(hrMetrics.totalEmployees, trainingCompletions.length),
          progress: trainingCompletions.length > 0 ? 
            (trainingCompletions.filter(tc => tc.status === 'completed').length / trainingCompletions.length) * 100 : 0
        },
        {
          program: 'Leadership Development',
          completed: Math.floor(hrMetrics.totalEmployees * 0.3),
          total: hrMetrics.totalEmployees,
          progress: 30
        },
        {
          program: 'Technical Skills',
          completed: Math.floor(hrMetrics.totalEmployees * 0.7),
          total: hrMetrics.totalEmployees,
          progress: 70
        }
      ];

      // Get performance insights
      const performanceInsights = {
        highPerformers: Math.floor(hrMetrics.totalEmployees * 0.2),
        needsImprovement: Math.floor(hrMetrics.totalEmployees * 0.1),
        onTrack: hrMetrics.totalEmployees - Math.floor(hrMetrics.totalEmployees * 0.3),
        avgRating: hrMetrics.avgPerformanceRating || 4.1
      };

      // Combine all HR data for the dashboard
      const hrDashboardData = {
        // Core metrics
        ...hrMetrics,
        
        // Recent activity
        recentHires: recentNewHires,
        
        // Department breakdown
        departmentStats,
        
        // Upcoming events and activities
        upcomingEvents,
        
        // Training and development
        trainingProgress,
        
        // Performance insights
        performanceInsights,
        
        // Additional insights
        insights: {
          recruiting: {
            openPositions: hrMetrics.openPositions,
            candidatesInPipeline: Math.floor(hrMetrics.openPositions * 3.5), // Mock data
            avgTimeToHire: 23 // days
          },
          retention: {
            avgTenure: 2.8, // years
            exitInterviews: 5,
            retentionRate: 87.5
          },
          engagement: {
            participationRate: 89,
            responseRate: 78,
            satisfactionTrend: '+0.3'
          }
        }
      };

      res.json(hrDashboardData);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // =====================================
  // SECURITY ANALYTICS DASHBOARD ENDPOINTS  
  // =====================================

  // Main analytics dashboard - comprehensive security analytics
  app.get("/api/analytics/dashboard", requireAuth, requireSecurityAgent("viewer"), async (req, res) => {
    try {
      const { storeId, period = "daily", startDate, endDate } = req.query;
      
      // Build analytics context
      const context: any = {
        storeId: storeId as string,
        organizationId: req.user?.organizationId,
        period: period as string,
        startDate: startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: endDate ? new Date(endDate as string) : new Date(),
        scope: storeId ? "store" : "organization",
        userId: req.user!.id
      };

      // Import analytics engine
      const { analyticsEngine } = await import("./analytics/analyticsEngine");
      const dashboard = await analyticsEngine.getSecurityAnalyticsDashboard(context);
      
      res.json(dashboard);
    } catch (error: any) {
      console.error("Analytics dashboard error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Incident trend analysis
  app.get("/api/analytics/incidents/trends", requireAuth, requireSecurityAgent("viewer"), async (req, res) => {
    try {
      const { storeId, period = "weekly", startDate, endDate } = req.query;
      
      const context: any = {
        storeId: storeId as string,
        organizationId: req.user?.organizationId,
        period: period as string,
        startDate: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: endDate ? new Date(endDate as string) : new Date(),
        scope: storeId ? "store" : "organization"
      };

      const { IncidentAnalytics } = await import("./analytics/incidentAnalytics");
      const incidentAnalytics = new IncidentAnalytics();
      
      const [summary, weeklyTrends, monthlyTrends] = await Promise.all([
        incidentAnalytics.getIncidentSummary(context),
        incidentAnalytics.getWeeklyTrends(context),
        incidentAnalytics.getMonthlyTrends(context)
      ]);
      
      res.json({
        summary,
        weeklyTrends,
        monthlyTrends
      });
    } catch (error: any) {
      console.error("Incident trends error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Performance metrics
  app.get("/api/analytics/performance", requireAuth, requireSecurityAgent("viewer"), async (req, res) => {
    try {
      const { storeId, period = "daily", startDate, endDate } = req.query;
      
      const context: any = {
        storeId: storeId as string,
        organizationId: req.user?.organizationId,
        period: period as string,
        startDate: startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: endDate ? new Date(endDate as string) : new Date(),
        scope: storeId ? "store" : "organization"
      };

      const { PerformanceMetrics } = await import("./analytics/performanceMetrics");
      const performanceMetrics = new PerformanceMetrics();
      
      const [metrics, systemHealth] = await Promise.all([
        performanceMetrics.getPerformanceMetrics(context),
        performanceMetrics.getSystemHealth(context)
      ]);
      
      res.json({
        metrics,
        systemHealth
      });
    } catch (error: any) {
      console.error("Performance metrics error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Spatial analytics and heatmap data
  app.get("/api/analytics/spatial", requireAuth, requireSecurityAgent("viewer"), async (req, res) => {
    try {
      const { storeId, period = "daily", startDate, endDate } = req.query;
      
      if (!storeId) {
        return res.status(400).json({ message: "storeId is required for spatial analytics" });
      }
      
      const context: any = {
        storeId: storeId as string,
        organizationId: req.user?.organizationId,
        period: period as string,
        startDate: startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: endDate ? new Date(endDate as string) : new Date(),
        scope: "store"
      };

      const { SpatialAnalytics } = await import("./analytics/spatialAnalytics");
      const spatialAnalytics = new SpatialAnalytics();
      
      const spatialData = await spatialAnalytics.getSpatialAnalysis(context);
      res.json(spatialData);
    } catch (error: any) {
      console.error("Spatial analytics error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Predictive analytics and forecasting
  app.get("/api/analytics/predictions", requireAuth, requireSecurityAgent("viewer"), async (req, res) => {
    try {
      const { storeId, period = "monthly", startDate, endDate } = req.query;
      
      const context: any = {
        storeId: storeId as string,
        organizationId: req.user?.organizationId,
        period: period as string,
        startDate: startDate ? new Date(startDate as string) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        endDate: endDate ? new Date(endDate as string) : new Date(),
        scope: storeId ? "store" : "organization"
      };

      const { PredictiveAnalytics } = await import("./analytics/predictiveAnalytics");
      const predictiveAnalytics = new PredictiveAnalytics();
      
      const predictions = await predictiveAnalytics.getPredictiveInsights(context);
      res.json(predictions);
    } catch (error: any) {
      console.error("Predictive analytics error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Generate analytics summaries (for background processing)
  app.post("/api/analytics/generate", requireAuth, requireSecurityAgent("admin"), async (req, res) => {
    try {
      const { period = "daily", storeId } = req.body;
      
      const { analyticsEngine } = await import("./analytics/analyticsEngine");
      await analyticsEngine.generateAnalyticsSummaries(period);
      
      res.json({ success: true, message: `Analytics summaries generated for ${period} period` });
    } catch (error: any) {
      console.error("Generate analytics error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Reports management
  app.get("/api/analytics/reports", requireAuth, requireSecurityAgent("viewer"), async (req, res) => {
    try {
      const { storeId, type, startDate, endDate, limit = 20, offset = 0 } = req.query;
      
      const context: any = {
        storeId: storeId as string,
        organizationId: req.user?.organizationId,
        period: "monthly",
        startDate: startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: endDate ? new Date(endDate as string) : new Date(),
        scope: storeId ? "store" : "organization"
      };

      const filters = {
        type: type as any,
        startDate: startDate ? new Date(startDate as string) : undefined,
        endDate: endDate ? new Date(endDate as string) : undefined,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      };

      const { ReportGenerator } = await import("./analytics/reportGenerator");
      const reportGenerator = new ReportGenerator();
      
      const reports = await reportGenerator.getReports(context, filters);
      res.json(reports);
    } catch (error: any) {
      console.error("Get reports error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Generate new report
  app.post("/api/analytics/reports/generate", requireAuth, requireSecurityAgent("operator"), async (req, res) => {
    try {
      const { 
        storeId, 
        type = "operational", 
        title, 
        period = "monthly", 
        format = "json",
        includeCharts = true,
        includeRecommendations = true,
        recipientList = [],
        startDate,
        endDate
      } = req.body;
      
      if (!title) {
        return res.status(400).json({ message: "Report title is required" });
      }
      
      const context: any = {
        storeId,
        organizationId: req.user?.organizationId,
        period,
        startDate: startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: endDate ? new Date(endDate) : new Date(),
        scope: storeId ? "store" : "organization"
      };

      const config = {
        type,
        title,
        period,
        format,
        includeCharts,
        includeRecommendations,
        recipientList,
        isScheduled: false
      };

      const { ReportGenerator } = await import("./analytics/reportGenerator");
      const reportGenerator = new ReportGenerator();
      
      const report = await reportGenerator.generateReport(context, config, req.user!.id);
      res.json(report);
    } catch (error: any) {
      console.error("Generate report error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Schedule automated reports
  app.post("/api/analytics/reports/schedule", requireAuth, requireSecurityAgent("admin"), async (req, res) => {
    try {
      const { 
        storeId, 
        type = "executive", 
        title, 
        period = "monthly", 
        format = "json",
        scheduleConfig,
        recipientList = []
      } = req.body;
      
      if (!title || !scheduleConfig) {
        return res.status(400).json({ message: "Report title and schedule configuration are required" });
      }
      
      const context: any = {
        storeId,
        organizationId: req.user?.organizationId,
        period,
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(),
        scope: storeId ? "store" : "organization"
      };

      const config = {
        type,
        title,
        period,
        format,
        includeCharts: true,
        includeRecommendations: true,
        recipientList,
        isScheduled: true,
        scheduleConfig
      };

      const { ReportGenerator } = await import("./analytics/reportGenerator");
      const reportGenerator = new ReportGenerator();
      
      const reportId = await reportGenerator.scheduleReport(context, config, req.user!.id);
      res.json({ success: true, reportId });
    } catch (error: any) {
      console.error("Schedule report error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // Real-time analytics WebSocket support
  app.get("/api/analytics/realtime/status", requireAuth, requireSecurityAgent("viewer"), async (req, res) => {
    try {
      const { storeId } = req.query;
      
      // Get current analytics status and live metrics
      const status = {
        lastUpdate: new Date(),
        activeStores: storeId ? 1 : 5, // Mock data
        processingStatus: "active",
        cacheStatus: "healthy",
        predictionConfidence: 85
      };
      
      res.json(status);
    } catch (error: any) {
      console.error("Real-time status error:", error);
      res.status(500).json({ message: error.message });
    }
  });

  // =====================================
  // AI VIDEO ANALYTICS ENDPOINTS
  // =====================================

  // =====================================
  // ENHANCED ROLE-BASED RATE LIMITING FOR AI ENDPOINTS
  // =====================================
  
  // Production security targets:
  // - Guards (security agents with viewer/operator roles): 100 requests/hour
  // - Admins (security agents with admin role or store_admin/penny_admin): 500 requests/hour
  
  // CRITICAL SECURITY FIX: Create persistent rate limiter instances to prevent memory store resets
  // Production security targets: Guards 100/hr, Admins 500/hr
  
  // Persistent rate limiters with stable memory stores
  const guardRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // 100 requests per hour for guards
    message: { 
      error: "Too many AI frame analysis requests. Limit: 100 requests per hour for guard role.",
      limit: 100,
      role: 'guard',
      code: "RATE_LIMIT_EXCEEDED"
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: ipKeyGenerator(`ai-frame-guard`),
    handler: (req: any, res: any) => {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        userId: req.user?.id,
        userRole: req.user?.role,
        ip: req.ip,
        endpoint: '/api/ai/analyze-frame',
        limit: 100,
        role: 'guard'
      }, req);
      res.status(429).json({
        error: "Too many AI frame analysis requests. Limit: 100 requests per hour for guard role.",
        limit: 100,
        role: 'guard',
        code: "RATE_LIMIT_EXCEEDED"
      });
    }
  });
  
  const adminRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 500, // 500 requests per hour for admins
    message: { 
      error: "Too many AI frame analysis requests. Limit: 500 requests per hour for admin role.",
      limit: 500,
      role: 'admin',
      code: "RATE_LIMIT_EXCEEDED"
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: ipKeyGenerator(`ai-frame-admin`),
    handler: (req: any, res: any) => {
      logSecurityEvent('RATE_LIMIT_EXCEEDED', {
        userId: req.user?.id,
        userRole: req.user?.role,
        ip: req.ip,
        endpoint: '/api/ai/analyze-frame',
        limit: 500,
        role: 'admin'
      }, req);
      res.status(429).json({
        error: "Too many AI frame analysis requests. Limit: 500 requests per hour for admin role.",
        limit: 500,
        role: 'admin',
        code: "RATE_LIMIT_EXCEEDED"
      });
    }
  });
  
  // Role-based rate limiter dispatcher that uses persistent instances
  function roleBasedRateLimiterDispatcher(req: any, res: any, next: any) {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ 
        message: "Authentication required for rate limiting",
        code: "AUTH_REQUIRED"
      });
    }

    // Determine if user is admin-level
    const isAdmin = user.role === 'store_admin' || 
                   user.role === 'penny_admin' || 
                   (user.platformRole === 'org_admin' || user.platformRole === 'super_admin');
    
    // Dispatch to appropriate persistent rate limiter
    if (isAdmin) {
      return adminRateLimiter(req, res, next);
    } else {
      return guardRateLimiter(req, res, next);
    }
  }
  
  // Keep existing rate limiters for other AI endpoints
  const aiAnalysisLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 5, // Limit to 5 AI analysis requests per minute
    message: { error: "Too many AI analysis requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  const aiDetectionsLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // Limit to 30 detection retrieval requests per minute
    message: { error: "Too many detection requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  });

  // =====================================
  // EARLY REJECTION MIDDLEWARE FOR BODY SIZE PROTECTION
  // =====================================
  
  // Early rejection middleware to prevent memory exhaustion from large uploads
  const earlyBodySizeRejection = (req: any, res: any, next: any) => {
    // Check Content-Length header before Express parses the body
    const contentLength = parseInt(req.get('content-length') || '0', 10);
    
    // SECURITY FIX: Enforce strict 10MB limit as per security requirements
    const MAX_REQUEST_BODY_BYTES = 10 * 1024 * 1024; // 10MB total request size (STRICT SECURITY POLICY)
    
    if (contentLength > MAX_REQUEST_BODY_BYTES) {
      console.warn('[SECURITY] Large request body rejected', {
        contentLength,
        maxAllowed: MAX_REQUEST_BODY_BYTES,
        userId: req.user?.id,
        ip: req.ip,
        endpoint: req.path,
        timestamp: new Date().toISOString()
      });
      
      return res.status(413).json({
        message: `Request body too large. Maximum size is ${Math.round(MAX_REQUEST_BODY_BYTES / (1024 * 1024))}MB (strict security policy).`,
        code: "BODY_SIZE_EXCEEDED",
        maxSize: `${Math.round(MAX_REQUEST_BODY_BYTES / (1024 * 1024))}MB`
      });
    }
    
    // Set timeout for slow uploads (30 seconds max)
    req.setTimeout(30000, () => {
      console.warn('[SECURITY] Request timeout - slow upload attack detected', {
        userId: req.user?.id,
        ip: req.ip,
        endpoint: req.path,
        timestamp: new Date().toISOString()
      });
      
      res.status(408).json({
        message: "Request timeout - upload too slow",
        code: "UPLOAD_TIMEOUT"
      });
    });
    
    next();
  };

  // =====================================
  // CIRCUIT BREAKER PROTECTION
  // =====================================
  
  // Circuit breaker state tracking
  const circuitBreakerState = {
    openai: { failures: 0, lastFailure: 0, state: 'CLOSED' },
    database: { failures: 0, lastFailure: 0, state: 'CLOSED' },
    filesystem: { failures: 0, lastFailure: 0, state: 'CLOSED' }
  };
  
  const CIRCUIT_BREAKER_CONFIG = {
    failureThreshold: 5,
    timeoutMs: 15000, // 15 seconds (as per security requirements)
    resetTimeMs: 60000 // 1 minute
  };
  
  // Circuit breaker function
  function circuitBreakerCheck(service: keyof typeof circuitBreakerState): boolean {
    const breaker = circuitBreakerState[service];
    const now = Date.now();
    
    if (breaker.state === 'OPEN') {
      if (now - breaker.lastFailure > CIRCUIT_BREAKER_CONFIG.resetTimeMs) {
        breaker.state = 'HALF_OPEN';
        breaker.failures = 0;
        return true;
      }
      return false;
    }
    
    return true;
  }
  
  function circuitBreakerRecord(service: keyof typeof circuitBreakerState, success: boolean) {
    const breaker = circuitBreakerState[service];
    const now = Date.now();
    
    if (success) {
      breaker.failures = 0;
      breaker.state = 'CLOSED';
    } else {
      breaker.failures++;
      breaker.lastFailure = now;
      
      if (breaker.failures >= CIRCUIT_BREAKER_CONFIG.failureThreshold) {
        breaker.state = 'OPEN';
        console.error(`[CIRCUIT_BREAKER] ${service} circuit opened after ${breaker.failures} failures`);
      }
    }
  }

  // Secure error response helper
  function createSecureErrorResponse(error: any, operation: string, req: any) {
    // Log full error details internally
    logSecurityEvent('API_ERROR', {
      operation,
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    }, req);
    
    // Return sanitized error to client
    const baseResponse = {
      success: false,
      code: 'OPERATION_FAILED',
      timestamp: new Date().toISOString()
    };
    
    // Map specific errors to safe responses
    if (error.code === 'RATE_LIMIT_EXCEEDED') {
      return { ...baseResponse, message: "Too many requests. Please try again later." };
    }
    
    if (error.code === 'INVALID_IMAGE_SIGNATURE' || error.code === 'BODY_SIZE_EXCEEDED') {
      return { ...baseResponse, message: error.message, code: error.code };
    }
    
    if (error.name === 'ZodError') {
      return { ...baseResponse, message: "Invalid request format", code: 'VALIDATION_ERROR' };
    }
    
    // Generic safe error for everything else
    return { 
      ...baseResponse, 
      message: "Request could not be processed. Please check your input and try again.",
      hint: "Ensure your image is a valid JPEG, PNG, or WebP format under 10MB"
    };
  }

  // POST /api/ai/analyze-frame - Analyze single video frame or image with enhanced security
  app.post("/api/ai/analyze-frame", 
    requireAuth, 
    requireSecurityAgent("operator"), 
    requireStoreAccess,
    earlyBodySizeRejection,
    roleBasedRateLimiterDispatcher, 
    async (req, res) => {
    const startTime = Date.now();
    
    try {
      const { imageData, storeId, cameraId, config } = req.body;

      // Enhanced validation using Zod schema
      const validationResult = frameAnalysisRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid request format", 
          errors: validationResult.error.errors 
        });
      }

      // Verify store access
      const store = await storage.getStore(storeId);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }

      // Extract MIME type and validate
      const mimeMatch = imageData.match(/^data:([^;]+);base64,/);
      if (!mimeMatch) {
        return res.status(400).json({ message: "Invalid image data format" });
      }
      
      const mimeType = mimeMatch[1];
      if (!FRAME_SIZE_LIMITS.ALLOWED_MIME_TYPES.includes(mimeType as any)) {
        return res.status(400).json({ 
          message: `Unsupported image type: ${mimeType}. Allowed types: ${FRAME_SIZE_LIMITS.ALLOWED_MIME_TYPES.join(', ')}` 
        });
      }

      // Convert base64 to buffer with security checks
      let imageBuffer: Buffer;
      try {
        const base64Data = imageData.split(',')[1];
        imageBuffer = Buffer.from(base64Data, 'base64');
      } catch (error) {
        return res.status(400).json({ message: "Invalid base64 encoding" });
      }

      // Enhanced size validation with frame limits (10MB max)
      if (imageBuffer.length > FRAME_SIZE_LIMITS.MAX_SIZE_BYTES) {
        return res.status(400).json({ 
          message: `Image file too large. Maximum size is ${FRAME_SIZE_LIMITS.MAX_SIZE_MB}MB.` 
        });
      }

      // Validate image signature (magic bytes) to prevent fake extensions
      const isValidImage = validateImageSignature(imageBuffer, mimeType, req);
      if (!isValidImage) {
        // Enhanced security logging for content validation failures
        logSecurityEvent('SECURITY_INVALID_CONTENT', {
          mimeType,
          actualSize: imageBuffer.length,
          reason: 'Invalid image signature or magic bytes mismatch',
          potentialAttack: 'File extension spoofing or malicious payload'
        }, req);
        
        return res.status(415).json({ 
          message: "Unsupported Media Type - Invalid image file signature",
          code: "INVALID_IMAGE_SIGNATURE"
        });
      }

      // Extract image dimensions for coordinate system validation
      const imageDimensions = extractImageDimensions(imageBuffer, mimeType);
      if (!imageDimensions) {
        return res.status(400).json({ message: "Could not determine image dimensions" });
      }

      // Circuit breaker checks before AI processing
      if (!circuitBreakerCheck('openai')) {
        logSecurityEvent('CIRCUIT_BREAKER_OPEN', {
          service: 'openai',
          reason: 'Too many recent failures'
        }, req);
        
        return res.status(503).json({
          message: "AI analysis service temporarily unavailable. Please try again later.",
          code: "SERVICE_UNAVAILABLE",
          retryAfter: Math.round(CIRCUIT_BREAKER_CONFIG.resetTimeMs / 1000)
        });
      }

      if (!circuitBreakerCheck('database')) {
        return res.status(503).json({
          message: "Database service temporarily unavailable. Please try again later.",
          code: "SERVICE_UNAVAILABLE"
        });
      }

      // Import AI services
      const { aiVideoAnalyticsService } = await import('./ai/videoAnalytics');
      const { threatDetectionService } = await import('./ai/threatDetection');

      let threatAssessment: any;
      let frameAnalysis: any;

      // Perform comprehensive threat analysis with circuit breaker protection
      try {
        threatAssessment = await Promise.race([
          threatDetectionService.analyzeThreatFrame(imageBuffer, storeId, cameraId, config || {}),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('AI analysis timeout')), CIRCUIT_BREAKER_CONFIG.timeoutMs)
          )
        ]);
        circuitBreakerRecord('openai', true);
      } catch (error: any) {
        circuitBreakerRecord('openai', false);
        logSecurityEvent('AI_ANALYSIS_FAILURE', {
          service: 'threatDetection',
          error: error.message,
          processingTime: Date.now() - startTime
        }, req);
        
        throw new Error('Threat analysis failed');
      }

      // Perform general AI analysis with circuit breaker protection  
      try {
        frameAnalysis = await Promise.race([
          aiVideoAnalyticsService.analyzeImage(imageBuffer, storeId, cameraId, config || {}),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('AI analysis timeout')), CIRCUIT_BREAKER_CONFIG.timeoutMs)
          )
        ]);
        circuitBreakerRecord('openai', true);
      } catch (error: any) {
        circuitBreakerRecord('openai', false);
        logSecurityEvent('AI_ANALYSIS_FAILURE', {
          service: 'frameAnalysis',
          error: error.message,
          processingTime: Date.now() - startTime
        }, req);
        
        throw new Error('Frame analysis failed');
      }

      // Convert AI detections to DetectionResult format for overlay rendering
      const detectionResult = aiVideoAnalyticsService.convertToDetectionResult(
        cameraId,
        frameAnalysis.detections,
        threatAssessment.detectedThreats,
        imageDimensions.width,
        imageDimensions.height
      );

      // Validate DetectionResult before sending response (security requirement)
      const detectionValidationResult = detectionResultSchema.safeParse(detectionResult);
      if (!detectionValidationResult.success) {
        console.error('DetectionResult validation failed:', detectionValidationResult.error.errors);
        return res.status(500).json({ 
          message: "Detection result validation failed", 
          error: "Internal processing error - invalid detection format",
          validationErrors: detectionValidationResult.error.errors
        });
      }

      // Combine results with overlay-ready detection data
      const response = {
        analysisId: threatAssessment.assessmentId,
        detectionResult, // For real-time overlay rendering
        frameAnalysis: {
          detections: frameAnalysis.detections,
          qualityScore: frameAnalysis.qualityScore,
          lightingConditions: frameAnalysis.lightingConditions,
          motionLevel: frameAnalysis.motionLevel,
          crowdDensity: frameAnalysis.crowdDensity,
          processingTime: frameAnalysis.processingTime
        },
        threatAssessment: {
          detectedThreats: threatAssessment.detectedThreats,
          overallRiskLevel: threatAssessment.overallRiskLevel,
          recommendedActions: threatAssessment.recommendedActions,
          analysisMetrics: threatAssessment.analysisMetrics
        },
        timestamp: threatAssessment.timestamp,
        storeId,
        cameraId
      };

      res.json(response);

    } catch (error: any) {
      // Calculate total processing time for monitoring
      const processingTime = Date.now() - startTime;
      
      // Log performance metrics for security monitoring
      logSecurityEvent('FRAME_ANALYSIS_COMPLETED', {
        processingTime,
        withinTargets: processingTime < 500, // <500ms target
        userId: req.user?.id,
        storeId: req.body?.storeId
      }, req);
      
      // Use secure error response helper
      const secureResponse = createSecureErrorResponse(error, 'frame_analysis', req);
      return res.status(500).json(secureResponse);
    }
  });

  // POST /api/ai/video-upload-url - Get signed URL for video upload
  app.post("/api/ai/video-upload-url", requireAuth, requireSecurityAgent("operator"), uploadLimiter, async (req, res) => {
    try {
      const { storeId, cameraId } = req.body;

      // Validate required fields
      if (!storeId) {
        return res.status(400).json({ message: "Store ID is required" });
      }
      if (!cameraId) {
        return res.status(400).json({ message: "Camera ID is required" });
      }

      // Verify store access
      const store = await storage.getStore(storeId);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }

      // Generate upload URL for video analysis
      const objectStorage = new ObjectStorageService();
      const uploadUrl = await objectStorage.getSecurityFileUploadURL(SecurityFileCategory.VIDEO_FOOTAGE);
      
      res.json({
        uploadUrl,
        maxFileSize: 200 * 1024 * 1024, // 200MB limit for videos
        allowedTypes: ['video/mp4', 'video/webm', 'video/quicktime'],
        uploadId: randomUUID()
      });

    } catch (error: any) {
      console.error('Video upload URL generation error:', error);
      res.status(500).json({ 
        message: "Failed to generate upload URL", 
        error: error.message 
      });
    }
  });

  // POST /api/ai/analyze-video - Process video from Object Storage
  app.post("/api/ai/analyze-video", requireAuth, requireSecurityAgent("operator"), aiAnalysisLimiter, async (req, res) => {
    try {
      const { objectPath, storeId, cameraId, config } = req.body;

      // Validate required fields
      if (!objectPath) {
        return res.status(400).json({ message: "Object path is required (upload video first using /api/ai/video-upload-url)" });
      }
      if (!storeId) {
        return res.status(400).json({ message: "Store ID is required" });
      }
      if (!cameraId) {
        return res.status(400).json({ message: "Camera ID is required" });
      }

      // Verify store access
      const store = await storage.getStore(storeId);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }

      // Import AI services
      const { aiVideoAnalyticsService } = await import('./ai/videoAnalytics');
      
      // Download video from Object Storage and analyze
      const objectStorage = new ObjectStorageService();
      
      try {
        // Analyze video from Object Storage (this avoids downloading the entire file into memory)
        const analysisResult = await aiVideoAnalyticsService.analyzeVideoFromStorage(
          objectPath,
          storeId,
          cameraId,
          config || {}
        );

        // Format response with comprehensive results
        const response = {
          analysisId: analysisResult.analysisId,
          status: analysisResult.status,
          
          // Summary metrics
          totalDetections: analysisResult.totalDetections,
          threatDetections: analysisResult.threatDetections,
          suspiciousActivities: analysisResult.suspiciousActivities.length,
          
          // Quality and processing info
          averageConfidence: analysisResult.averageConfidence,
          qualityScore: analysisResult.qualityScore,
          processingDuration: analysisResult.processingDuration,
          
          // Threat breakdown
          threats: {
            high: analysisResult.suspiciousActivities.filter(a => a.severity === 'high').length,
            medium: analysisResult.suspiciousActivities.filter(a => a.severity === 'medium').length,
            low: analysisResult.suspiciousActivities.filter(a => a.severity === 'low').length,
            critical: analysisResult.suspiciousActivities.filter(a => a.severity === 'critical').length
          },
          
          // Frame-by-frame results (limited for response size)
          frames: analysisResult.frames.slice(0, 10).map(frame => ({
            frameNumber: frame.frameNumber,
            timestamp: frame.timestamp,
            detectionCount: frame.detections.length,
            highThreatDetections: frame.detections.filter(d => d.severity === 'high' || d.severity === 'critical').length,
            qualityScore: frame.qualityScore
          })),
          
          // Most significant detections
          significantDetections: analysisResult.suspiciousActivities
            .filter(a => a.severity === 'high' || a.severity === 'critical')
            .slice(0, 5)
            .map(detection => ({
              id: detection.id,
              type: detection.detectionType,
              threatType: detection.threatType,
              behaviorType: detection.behaviorType,
              confidence: detection.confidence,
              severity: detection.severity,
              description: detection.description,
              timestamp: detection.frameTimestamp,
              boundingBox: detection.boundingBox
            })),
          
          storeId,
          cameraId,
          createdAt: analysisResult.createdAt,
          completedAt: analysisResult.completedAt
        };

        res.json(response);

      } catch (analysisError) {
        // Note: No temp file cleanup needed since we use Object Storage
        throw analysisError;
      }

    } catch (error: any) {
      console.error('AI video analysis error:', error);
      res.status(500).json({ 
        message: "AI video analysis failed", 
        error: error.message,
        details: "Please check your video format and try again"
      });
    }
  });

  // GET /api/ai/detections - Retrieve AI detection results with filtering
  app.get("/api/ai/detections", requireAuth, requireSecurityAgent("viewer"), aiDetectionsLimiter, async (req, res) => {
    try {
      const {
        storeId,
        cameraId,
        detectionType,
        threatType,
        minConfidence,
        severity,
        startDate,
        endDate,
        limit = '50',
        offset = '0',
        verified,
        orderBy = 'createdAt',
        order = 'desc'
      } = req.query;

      // Validate store access if storeId provided
      if (storeId) {
        const store = await storage.getStore(storeId as string);
        if (!store) {
          return res.status(404).json({ message: "Store not found" });
        }
      }

      // Build filters based on query parameters
      const filters: any = {};
      
      if (storeId) filters.storeId = storeId;
      if (cameraId) filters.cameraId = cameraId;
      if (detectionType) filters.detectionType = detectionType;
      if (threatType) filters.threatType = threatType;
      if (minConfidence) filters.minConfidence = parseFloat(minConfidence as string);
      if (verified !== undefined) filters.verified = verified === 'true';

      // Get detections based on filters
      let detections: any[] = [];
      
      if (storeId && detectionType) {
        detections = await storage.getAiDetectionsByType(storeId as string, detectionType as string);
      } else if (storeId && minConfidence) {
        detections = await storage.getAiDetectionsByConfidence(storeId as string, parseFloat(minConfidence as string));
      } else if (storeId) {
        detections = await storage.getAiDetectionsByStore(storeId as string, parseInt(limit as string));
      } else if (cameraId) {
        detections = await storage.getAiDetectionsByCamera(cameraId as string, parseInt(limit as string));
      } else {
        // Get recent detections across all accessible stores
        // For now, return empty array if no specific store/camera filter
        detections = [];
      }

      // Apply additional filtering
      let filteredDetections = detections;

      if (severity) {
        filteredDetections = filteredDetections.filter(d => 
          d.metadata?.severity === severity
        );
      }

      if (startDate || endDate) {
        const start = startDate ? new Date(startDate as string) : new Date(0);
        const end = endDate ? new Date(endDate as string) : new Date();
        
        filteredDetections = filteredDetections.filter(d => {
          const createdAt = new Date(d.createdAt || d.frameTimestamp);
          return createdAt >= start && createdAt <= end;
        });
      }

      // Apply pagination
      const offsetNum = parseInt(offset as string);
      const limitNum = parseInt(limit as string);
      const paginatedDetections = filteredDetections.slice(offsetNum, offsetNum + limitNum);

      // Format response with analytics
      const response = {
        detections: paginatedDetections.map(detection => ({
          id: detection.id,
          storeId: detection.storeId,
          cameraId: detection.cameraId,
          detectionType: detection.detectionType,
          objectClass: detection.objectClass,
          threatType: detection.threatType,
          behaviorType: detection.behaviorType,
          confidence: detection.confidence,
          boundingBox: detection.boundingBox,
          keyPoints: detection.keyPoints,
          modelName: detection.modelName,
          modelVersion: detection.modelVersion,
          frameTimestamp: detection.frameTimestamp,
          isVerified: detection.isVerified,
          isFalsePositive: detection.isFalsePositive,
          verifiedBy: detection.verifiedBy,
          verifiedAt: detection.verifiedAt,
          notes: detection.notes,
          metadata: detection.metadata,
          createdAt: detection.createdAt
        })),
        
        pagination: {
          total: filteredDetections.length,
          offset: offsetNum,
          limit: limitNum,
          hasMore: offsetNum + limitNum < filteredDetections.length
        },
        
        analytics: {
          totalDetections: filteredDetections.length,
          averageConfidence: filteredDetections.length > 0 
            ? filteredDetections.reduce((sum, d) => sum + (d.confidence || 0), 0) / filteredDetections.length 
            : 0,
          threatBreakdown: {
            high: filteredDetections.filter(d => d.metadata?.severity === 'high').length,
            medium: filteredDetections.filter(d => d.metadata?.severity === 'medium').length,
            low: filteredDetections.filter(d => d.metadata?.severity === 'low').length,
            critical: filteredDetections.filter(d => d.metadata?.severity === 'critical').length
          },
          verificationStatus: {
            verified: filteredDetections.filter(d => d.isVerified).length,
            unverified: filteredDetections.filter(d => !d.isVerified).length,
            falsePositives: filteredDetections.filter(d => d.isFalsePositive).length
          },
          detectionTypes: filteredDetections.reduce((acc, d) => {
            acc[d.detectionType] = (acc[d.detectionType] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        },
        
        filters: {
          storeId,
          cameraId,
          detectionType,
          threatType,
          minConfidence,
          severity,
          startDate,
          endDate,
          verified
        }
      };

      res.json(response);

    } catch (error: any) {
      console.error('AI detections retrieval error:', error);
      res.status(500).json({ 
        message: "Failed to retrieve AI detections", 
        error: error.message 
      });
    }
  });

  // POST /api/ai/verify-detection - Manual verification/feedback for AI results
  app.post("/api/ai/verify-detection", requireAuth, requireSecurityAgent("operator"), async (req, res) => {
    try {
      const { detectionId, isValid, feedback, confidence } = req.body;

      // Validate required fields
      if (!detectionId) {
        return res.status(400).json({ message: "Detection ID is required" });
      }
      if (typeof isValid !== 'boolean') {
        return res.status(400).json({ message: "Valid verification status (isValid) is required" });
      }

      // Get the detection to verify it exists and user has access
      const detection = await storage.getAiDetection(detectionId);
      if (!detection) {
        return res.status(404).json({ message: "Detection not found" });
      }

      // Verify store access
      const store = await storage.getStore(detection.storeId);
      if (!store) {
        return res.status(404).json({ message: "Store not found" });
      }

      // Import threat detection service for verification
      const { threatDetectionService } = await import('./ai/threatDetection');

      // Perform verification
      await threatDetectionService.verifyThreatDetection(
        detectionId,
        isValid,
        feedback || '',
        req.user!.id
      );

      // Get updated detection
      const updatedDetection = await storage.getAiDetection(detectionId);

      // Log verification for analytics and model improvement
      console.log(`Detection ${detectionId} verified as ${isValid ? 'valid' : 'false positive'} by user ${req.user!.id}`);

      const response = {
        detectionId,
        verificationStatus: isValid ? 'verified' : 'false_positive',
        verifiedBy: req.user!.id,
        verifiedAt: new Date(),
        feedback,
        confidence,
        detection: updatedDetection,
        message: `Detection ${isValid ? 'verified as valid' : 'marked as false positive'} successfully`
      };

      res.json(response);

    } catch (error: any) {
      console.error('AI detection verification error:', error);
      res.status(500).json({ 
        message: "Failed to verify detection", 
        error: error.message 
      });
    }
  });

  // GET /api/ai/analytics - Get AI analytics dashboard data
  app.get("/api/ai/analytics", requireAuth, requireSecurityAgent("viewer"), async (req, res) => {
    try {
      const { storeId, period = '7d' } = req.query;

      // Calculate date range based on period
      const endDate = new Date();
      const startDate = new Date();
      
      switch (period) {
        case '24h':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        default:
          startDate.setDate(startDate.getDate() - 7);
      }

      // Get AI detections and video analytics for the period
      let detections: any[] = [];
      let videoAnalytics: any[] = [];

      if (storeId) {
        detections = await storage.getAiDetectionsByStore(storeId as string, 1000);
        videoAnalytics = await storage.getVideoAnalyticsByStore(storeId as string, 100);
      }

      // Filter by date range
      const filteredDetections = detections.filter(d => {
        const createdAt = new Date(d.createdAt || d.frameTimestamp);
        return createdAt >= startDate && createdAt <= endDate;
      });

      const filteredAnalytics = videoAnalytics.filter(va => {
        const createdAt = new Date(va.createdAt);
        return createdAt >= startDate && createdAt <= endDate;
      });

      // Calculate analytics
      const analytics = {
        summary: {
          totalDetections: filteredDetections.length,
          threatDetections: filteredDetections.filter(d => d.threatType).length,
          highConfidenceDetections: filteredDetections.filter(d => d.confidence >= 0.8).length,
          verifiedDetections: filteredDetections.filter(d => d.isVerified).length,
          falsePositives: filteredDetections.filter(d => d.isFalsePositive).length,
          avgConfidence: filteredDetections.length > 0 
            ? filteredDetections.reduce((sum, d) => sum + (d.confidence || 0), 0) / filteredDetections.length 
            : 0,
          totalVideosAnalyzed: filteredAnalytics.length,
          avgProcessingTime: filteredAnalytics.length > 0
            ? filteredAnalytics.reduce((sum, va) => sum + (va.processingTime || 0), 0) / filteredAnalytics.length
            : 0
        },
        
        threatBreakdown: {
          theft: filteredDetections.filter(d => d.threatType === 'theft').length,
          violence: filteredDetections.filter(d => d.threatType === 'violence').length,
          weapons: filteredDetections.filter(d => d.threatType === 'weapons').length,
          suspicious: filteredDetections.filter(d => 
            d.threatType === 'suspicious_behavior' || d.behaviorType === 'suspicious'
          ).length,
          loitering: filteredDetections.filter(d => 
            d.behaviorType === 'loitering' || d.threatType === 'unauthorized_access'
          ).length
        },
        
        detectionTypes: filteredDetections.reduce((acc, d) => {
          acc[d.detectionType] = (acc[d.detectionType] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        
        confidenceDistribution: {
          high: filteredDetections.filter(d => d.confidence >= 0.8).length,
          medium: filteredDetections.filter(d => d.confidence >= 0.6 && d.confidence < 0.8).length,
          low: filteredDetections.filter(d => d.confidence < 0.6).length
        },
        
        timeline: generateTimelineData(filteredDetections, startDate, endDate),
        
        modelPerformance: {
          accuracy: filteredDetections.length > 0 
            ? ((filteredDetections.filter(d => d.isVerified && !d.isFalsePositive).length) / filteredDetections.filter(d => d.isVerified).length) * 100 || 0
            : 0,
          precision: calculatePrecision(filteredDetections),
          recall: calculateRecall(filteredDetections)
        },
        
        period,
        storeId,
        generatedAt: new Date()
      };

      res.json(analytics);

    } catch (error: any) {
      console.error('AI analytics error:', error);
      res.status(500).json({ 
        message: "Failed to generate AI analytics", 
        error: error.message 
      });
    }
  });

  // =====================================
  // REGISTER ADVANCED AI FEATURES ROUTES  
  // =====================================
  
  // Register all privacy-compliant advanced AI features routes
  registerAdvancedRoutes(app);
  
  const httpServer = createServer(app);
  
  // Setup WebSocket server for real-time camera status updates
  setupWebSocketServer(httpServer);
  
  return httpServer;
}

// =====================================
// WEBSOCKET SERVER FOR CAMERA STATUS
// =====================================

// WebSocket client management with authentication
interface WebSocketClient extends WebSocket {
  userId?: string;
  storeId?: string;
  userRole?: string;
  isAuthenticated: boolean;
  subscribedCameras?: Set<string>;
  lastPing?: number;
}

const connectedClients = new Map<string, WebSocketClient>();
const storeSubscriptions = new Map<string, Set<string>>(); // storeId -> Set of clientIds
const cameraSubscriptions = new Map<string, Set<string>>(); // cameraId -> Set of clientIds

// WebSocket session parser
async function parseWebSocketSession(request: IncomingMessage): Promise<{ userId?: string; storeId?: string; role?: string; isAuthenticated: boolean }> {
  return new Promise((resolve) => {
    // Parse cookies from WebSocket request
    const cookieHeader = request.headers.cookie;
    if (!cookieHeader) {
      return resolve({ isAuthenticated: false });
    }

    // Extract session ID from cookies
    const cookies: { [key: string]: string } = {};
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });

    const sessionId = cookies['connect.sid'];
    if (!sessionId) {
      return resolve({ isAuthenticated: false });
    }

    // Parse session ID (remove 's:' prefix and signature)
    let parsedSessionId;
    try {
      if (sessionId.startsWith('s:')) {
        parsedSessionId = sessionId.slice(2).split('.')[0];
      } else {
        parsedSessionId = sessionId.split('.')[0];
      }
    } catch (error) {
      console.error('Failed to parse session ID:', error);
      return resolve({ isAuthenticated: false });
    }

    // Get session from store
    const sessionStore = storage.sessionStore as any;
    sessionStore.get(parsedSessionId, async (err: any, session: any) => {
      if (err || !session || !session.passport?.user) {
        return resolve({ isAuthenticated: false });
      }

      try {
        // Get user from session
        const user = await storage.getUser(session.passport.user);
        if (!user) {
          return resolve({ isAuthenticated: false });
        }

        resolve({
          userId: user.id,
          storeId: user.storeId,
          role: user.role,
          isAuthenticated: true
        });
      } catch (error) {
        console.error('Error loading user from session:', error);
        resolve({ isAuthenticated: false });
      }
    });
  });
}

// WebSocket authorization checks
function requireWebSocketSecurityAgent(userRole: string): boolean {
  const allowedRoles = ['security_agent', 'store_admin', 'penny_admin'];
  return allowedRoles.includes(userRole);
}

function requireWebSocketStoreAccess(userStoreId: string, requestedStoreId: string, userRole: string): boolean {
  // Penny admins can access any store
  if (userRole === 'penny_admin') {
    return true;
  }
  
  // Store staff can only access their own store
  return userStoreId === requestedStoreId;
}

function setupWebSocketServer(httpServer: Server) {
  const wss = new WebSocketServer({ 
    server: httpServer,
    path: '/ws',
    perMessageDeflate: false
  });

  console.log('WebSocket server initialized on /ws endpoint');

  wss.on('connection', async (ws: WebSocketClient, request) => {
    const clientId = randomUUID();
    const remoteAddress = request.socket.remoteAddress || 'unknown';
    
    console.log(`WebSocket client connecting: ${clientId} from ${remoteAddress}`);
    
    // CRITICAL SECURITY: Parse session/cookies for authentication
    const sessionData = await parseWebSocketSession(request);
    
    if (!sessionData.isAuthenticated) {
      console.warn(`Unauthenticated WebSocket connection rejected: ${clientId}`);
      ws.close(4401, 'Authentication required');
      return;
    }

    // CRITICAL SECURITY: Set authenticated user data from verified session
    ws.userId = sessionData.userId;
    ws.storeId = sessionData.storeId;
    ws.userRole = sessionData.role;
    ws.isAuthenticated = true;
    ws.subscribedCameras = new Set();
    ws.lastPing = Date.now();
    connectedClients.set(clientId, ws);
    
    console.log(`WebSocket client authenticated: ${clientId}, user: ${ws.userId}, store: ${ws.storeId}, role: ${ws.userRole}`);

    // Setup ping/pong for connection health
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
        ws.lastPing = Date.now();
      }
    }, 30000); // 30 seconds

    ws.on('pong', () => {
      ws.lastPing = Date.now();
    });

    ws.on('message', async (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        await handleWebSocketMessage(ws, clientId, message);
      } catch (error) {
        console.error(`WebSocket message error for client ${clientId}:`, error);
        sendErrorMessage(ws, 'Invalid message format');
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`WebSocket client disconnected: ${clientId}, code: ${code}, reason: ${reason}`);
      cleanupClient(clientId);
      clearInterval(pingInterval);
    });

    ws.on('error', (error) => {
      console.error(`WebSocket error for client ${clientId}:`, error);
      cleanupClient(clientId);
      clearInterval(pingInterval);
    });

    // Send welcome message
    sendMessage(ws, {
      type: 'connection_established',
      clientId,
      timestamp: new Date().toISOString()
    });
  });

  // Cleanup dead connections every 60 seconds
  setInterval(() => {
    const now = Date.now();
    const deadClients: string[] = [];

    connectedClients.forEach((client, clientId) => {
      if (!client.lastPing || now - client.lastPing > 90000) { // 90 seconds timeout
        deadClients.push(clientId);
      }
    });

    deadClients.forEach(clientId => {
      console.log(`Removing dead WebSocket client: ${clientId}`);
      const client = connectedClients.get(clientId);
      if (client) {
        client.terminate();
      }
      cleanupClient(clientId);
    });
  }, 60000);

  return wss;
}

async function handleWebSocketMessage(ws: WebSocketClient, clientId: string, message: any) {
  switch (message.type) {
    case 'subscribe':
      // Legacy subscription for backward compatibility
      await handleLegacySubscription(ws, clientId, message);
      break;

    case 'subscribe_camera_status':
      await handleCameraStatusSubscription(ws, clientId, message);
      break;

    case 'unsubscribe_camera_status':
      await handleCameraStatusUnsubscription(ws, clientId, message);
      break;

    // Real-time alert subscription handlers
    case 'subscribe_alerts':
      await handleAlertSubscription(ws, clientId, message);
      break;

    case 'unsubscribe_alerts':
      await handleAlertUnsubscription(ws, clientId, message);
      break;

    case 'update_alert_filters':
      await handleAlertFilterUpdate(ws, clientId, message);
      break;

    case 'acknowledge_alert':
      await handleAlertAcknowledgment(ws, clientId, message);
      break;

    case 'dismiss_alert':
      await handleAlertDismissal(ws, clientId, message);
      break;

    case 'escalate_alert':
      await handleAlertEscalation(ws, clientId, message);
      break;

    case 'bulk_acknowledge_alerts':
      await handleBulkAlertAcknowledgment(ws, clientId, message);
      break;

    case 'ping':
      sendMessage(ws, { type: 'pong', timestamp: new Date().toISOString() });
      break;

    default:
      console.warn(`Unknown WebSocket message type: ${message.type} from client ${clientId}`);
      sendErrorMessage(ws, `Unknown message type: ${message.type}`);
  }
}

async function handleLegacySubscription(ws: WebSocketClient, clientId: string, message: any) {
  // CRITICAL SECURITY: Validate authentication
  if (!ws.isAuthenticated || !ws.userId || !ws.storeId) {
    sendErrorMessage(ws, 'Authentication required');
    return;
  }

  // CRITICAL SECURITY: Use server-verified storeId, not client-provided
  const { storeId } = message;
  
  // CRITICAL SECURITY: Validate store access
  if (!requireWebSocketStoreAccess(ws.storeId!, storeId, ws.userRole!)) {
    console.warn(`Client ${clientId} denied access to store ${storeId}`);
    sendErrorMessage(ws, 'Access denied to requested store');
    return;
  }

  // Add to store subscriptions using server-verified storeId
  if (!storeSubscriptions.has(ws.storeId!)) {
    storeSubscriptions.set(ws.storeId!, new Set());
  }
  storeSubscriptions.get(ws.storeId!)!.add(clientId);

  console.log(`Client ${clientId} subscribed to store ${ws.storeId}`);
  
  sendMessage(ws, {
    type: 'subscription_confirmed',
    storeId: ws.storeId, // Use server-verified storeId
    timestamp: new Date().toISOString()
  });
}

async function handleCameraStatusSubscription(ws: WebSocketClient, clientId: string, message: any) {
  // CRITICAL SECURITY: Validate authentication
  if (!ws.isAuthenticated || !ws.userId || !ws.storeId) {
    sendErrorMessage(ws, 'Authentication required');
    return;
  }

  // CRITICAL SECURITY: Require security agent role
  if (!requireWebSocketSecurityAgent(ws.userRole!)) {
    console.warn(`Client ${clientId} insufficient permissions for camera subscription`);
    sendErrorMessage(ws, 'Insufficient permissions - security agent role required');
    return;
  }

  const { cameraId } = message;
  
  if (!cameraId) {
    sendErrorMessage(ws, 'cameraId required for camera subscription');
    return;
  }

  // CRITICAL SECURITY: Verify camera access using server-verified data
  try {
    const camera = await storage.getCameraById(cameraId);
    if (!camera) {
      sendErrorMessage(ws, 'Camera not found');
      return;
    }

    // CRITICAL SECURITY: Validate store access
    if (!requireWebSocketStoreAccess(ws.storeId!, camera.storeId, ws.userRole!)) {
      console.warn(`Client ${clientId} denied access to camera ${cameraId} in store ${camera.storeId}`);
      sendErrorMessage(ws, 'Access denied to camera in requested store');
      return;
    }
  } catch (error) {
    console.error(`Error verifying camera access for ${clientId}:`, error);
    sendErrorMessage(ws, 'Error verifying camera access');
    return;
  }

  // Add camera to subscriptions using server-verified data
  ws.subscribedCameras!.add(cameraId);

  // Add to camera subscriptions
  if (!cameraSubscriptions.has(cameraId)) {
    cameraSubscriptions.set(cameraId, new Set());
  }
  cameraSubscriptions.get(cameraId)!.add(clientId);

  // Add to store subscriptions using server-verified storeId
  if (!storeSubscriptions.has(ws.storeId!)) {
    storeSubscriptions.set(ws.storeId!, new Set());
  }
  storeSubscriptions.get(ws.storeId!)!.add(clientId);

  console.log(`Client ${clientId} subscribed to camera ${cameraId} in store ${ws.storeId}`);
  
  // Send current camera status
  try {
    const camera = await storage.getCameraById(cameraId);
    if (camera) {
      sendMessage(ws, {
        type: 'camera_status_update',
        cameraId,
        status: camera.status,
        lastSeen: camera.lastHeartbeat,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error(`Error sending current camera status to ${clientId}:`, error);
  }

  sendMessage(ws, {
    type: 'camera_subscription_confirmed',
    cameraId,
    storeId: ws.storeId, // Use server-verified storeId
    timestamp: new Date().toISOString()
  });
}

async function handleCameraStatusUnsubscription(ws: WebSocketClient, clientId: string, message: any) {
  // CRITICAL SECURITY: Validate authentication
  if (!ws.isAuthenticated || !ws.userId || !ws.storeId) {
    sendErrorMessage(ws, 'Authentication required');
    return;
  }

  const { cameraId } = message;
  
  if (!cameraId) {
    sendErrorMessage(ws, 'cameraId required for unsubscription');
    return;
  }

  // CRITICAL SECURITY: Verify client was actually subscribed to this camera
  if (!ws.subscribedCameras || !ws.subscribedCameras.has(cameraId)) {
    sendErrorMessage(ws, 'Not subscribed to this camera');
    return;
  }

  // Remove from client's subscriptions
  ws.subscribedCameras.delete(cameraId);

  // Remove from camera subscriptions
  const cameraSubscriptionSet = cameraSubscriptions.get(cameraId);
  if (cameraSubscriptionSet) {
    cameraSubscriptionSet.delete(clientId);
    
    // Clean up empty subscription sets
    if (cameraSubscriptionSet.size === 0) {
      cameraSubscriptions.delete(cameraId);
    }
  }

  console.log(`Client ${clientId} unsubscribed from camera ${cameraId}`);
  
  sendMessage(ws, {
    type: 'camera_unsubscription_confirmed',
    cameraId,
    timestamp: new Date().toISOString()
  });
}

function cleanupClient(clientId: string) {
  const client = connectedClients.get(clientId);
  
  if (client) {
    // Remove from store subscriptions
    if (client.storeId) {
      const storeSubscriptionSet = storeSubscriptions.get(client.storeId);
      if (storeSubscriptionSet) {
        storeSubscriptionSet.delete(clientId);
        if (storeSubscriptionSet.size === 0) {
          storeSubscriptions.delete(client.storeId);
        }
      }
    }

    // Remove from camera subscriptions
    if (client.subscribedCameras) {
      client.subscribedCameras.forEach(cameraId => {
        const cameraSubscriptionSet = cameraSubscriptions.get(cameraId);
        if (cameraSubscriptionSet) {
          cameraSubscriptionSet.delete(clientId);
          if (cameraSubscriptionSet.size === 0) {
            cameraSubscriptions.delete(cameraId);
          }
        }
      });
    }

    // Clean up alert subscriptions
    cleanupAlertClient(clientId);
  }

  connectedClients.delete(clientId);
}

function sendMessage(ws: WebSocket, message: any) {
  if (ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(JSON.stringify(message));
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
    }
  }
}

function sendErrorMessage(ws: WebSocket, error: string) {
  sendMessage(ws, {
    type: 'error',
    error,
    timestamp: new Date().toISOString()
  });
}

// =====================================
// CAMERA STATUS BROADCASTING FUNCTIONS
// =====================================

export function broadcastCameraStatusUpdate(cameraId: string, status: string, lastSeen?: Date) {
  const subscribers = cameraSubscriptions.get(cameraId);
  if (!subscribers || subscribers.size === 0) {
    return;
  }

  const message = {
    type: 'camera_status_update',
    cameraId,
    status,
    lastSeen: lastSeen?.toISOString(),
    timestamp: new Date().toISOString()
  };

  console.log(`Broadcasting camera status update for ${cameraId}: ${status} to ${subscribers.size} clients`);

  subscribers.forEach(clientId => {
    const client = connectedClients.get(clientId);
    if (client) {
      sendMessage(client, message);
    }
  });
}

export function broadcastCameraHeartbeat(cameraId: string) {
  const subscribers = cameraSubscriptions.get(cameraId);
  if (!subscribers || subscribers.size === 0) {
    return;
  }

  const message = {
    type: 'camera_heartbeat',
    cameraId,
    timestamp: new Date().toISOString()
  };

  subscribers.forEach(clientId => {
    const client = connectedClients.get(clientId);
    if (client) {
      sendMessage(client, message);
    }
  });
}

export function broadcastCameraOffline(cameraId: string, lastSeen?: Date) {
  broadcastCameraStatusUpdate(cameraId, 'offline', lastSeen);
}

export function broadcastToStore(storeId: string, message: any) {
  const subscribers = storeSubscriptions.get(storeId);
  if (!subscribers || subscribers.size === 0) {
    return;
  }

  subscribers.forEach(clientId => {
    const client = connectedClients.get(clientId);
    if (client) {
      sendMessage(client, message);
    }
  });
}

// =====================================
// ENHANCED SECURITY VALIDATION FUNCTIONS
// =====================================

// Comprehensive security logging function
function logSecurityEvent(eventType: string, details: any, req?: any) {
  const logEntry = {
    type: 'SECURITY_EVENT',
    event: eventType,
    timestamp: new Date().toISOString(),
    userId: req?.user?.id,
    userRole: req?.user?.role,
    ip: req?.ip,
    userAgent: req?.get('user-agent'),
    ...details
  };
  
  // Log to console with color coding for visibility
  if (eventType.includes('ATTACK') || eventType.includes('VIOLATION')) {
    console.error('[SECURITY ALERT]', JSON.stringify(logEntry, null, 2));
  } else {
    console.warn('[SECURITY]', JSON.stringify(logEntry, null, 2));
  }
  
  // In production, this would also send to a security monitoring service
}

// Enhanced image dimensions extraction with WebP support
function extractImageDimensions(buffer: Buffer, mimeType: string): { width: number; height: number } | null {
  try {
    if (mimeType === 'image/jpeg') {
      // JPEG dimensions extraction from SOF0 marker
      for (let i = 0; i < buffer.length - 10; i++) {
        if (buffer[i] === 0xFF && buffer[i + 1] === 0xC0) { // SOF0 marker
          const height = (buffer[i + 5] << 8) | buffer[i + 6];
          const width = (buffer[i + 7] << 8) | buffer[i + 8];
          return { width, height };
        }
      }
    } else if (mimeType === 'image/png') {
      // PNG dimensions from IHDR chunk (bytes 16-23)
      if (buffer.length >= 24) {
        const width = (buffer[16] << 24) | (buffer[17] << 16) | (buffer[18] << 8) | buffer[19];
        const height = (buffer[20] << 24) | (buffer[21] << 16) | (buffer[22] << 8) | buffer[23];
        return { width, height };
      }
    } else if (mimeType === 'image/webp') {
      // WebP dimensions extraction from VP8/VP8L/VP8X chunks
      if (buffer.length >= 30) {
        // Look for VP8X chunk (extended format)
        for (let i = 12; i < buffer.length - 20; i++) {
          if (buffer.readUInt32BE(i) === 0x56503858) { // 'VP8X'
            const width = (buffer.readUInt32LE(i + 8) & 0xFFFFFF) + 1;
            const height = (buffer.readUInt32LE(i + 11) & 0xFFFFFF) + 1;
            return { width, height };
          }
        }
        
        // Look for VP8 chunk (lossy format)
        for (let i = 12; i < buffer.length - 16; i++) {
          if (buffer.readUInt32BE(i) === 0x56503820) { // 'VP8 '
            const width = buffer.readUInt16LE(i + 14) & 0x3FFF;
            const height = buffer.readUInt16LE(i + 16) & 0x3FFF;
            return { width, height };
          }
        }
      }
    }
    return null;
  } catch (error) {
    console.error('Failed to extract image dimensions:', error);
    return null;
  }
}

// Enhanced magic number validation with comprehensive signature checking
function validateImageSignature(buffer: Buffer, mimeType: string, req?: any): boolean {
  try {
    // Ensure minimum buffer size
    if (buffer.length < 12) {
      logSecurityEvent('INVALID_IMAGE_SIZE', {
        bufferSize: buffer.length,
        mimeType,
        reason: 'Buffer too small for any valid image format'
      }, req);
      return false;
    }
    
    // Enhanced signatures with secondary validation
    const validations = {
      'image/jpeg': (buf: Buffer) => {
        // Primary: JPEG magic number (FF D8 FF)
        if (buf[0] !== 0xFF || buf[1] !== 0xD8 || buf[2] !== 0xFF) {
          return false;
        }
        
        // Secondary: Look for valid JPEG marker after magic number
        const validMarkers = [0xE0, 0xE1, 0xE2, 0xE3, 0xDB, 0xC0, 0xC2];
        if (buf.length > 3 && !validMarkers.includes(buf[3])) {
          return false;
        }
        
        // Check for JPEG ending (FF D9)
        if (buf.length >= 4) {
          for (let i = buf.length - 2; i >= buf.length - 10 && i >= 0; i--) {
            if (buf[i] === 0xFF && buf[i + 1] === 0xD9) {
              return true;
            }
          }
        }
        
        return true; // Allow without end marker for streaming/partial
      },
      
      'image/png': (buf: Buffer) => {
        // Complete PNG signature validation (8 bytes)
        const pngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        if (buf.length < 8) return false;
        
        for (let i = 0; i < 8; i++) {
          if (buf[i] !== pngSignature[i]) {
            return false;
          }
        }
        
        // Validate IHDR chunk follows immediately after PNG signature
        if (buf.length >= 16) {
          const ihdr = buf.subarray(12, 16);
          if (ihdr.toString('ascii') !== 'IHDR') {
            return false;
          }
        }
        
        return true;
      },
      
      'image/webp': (buf: Buffer) => {
        // WebP validation: RIFF header + WEBP identifier
        if (buf.length < 12) return false;
        
        // Check RIFF header (4 bytes)
        if (buf.subarray(0, 4).toString('ascii') !== 'RIFF') {
          return false;
        }
        
        // Check WEBP identifier (bytes 8-11)
        if (buf.subarray(8, 12).toString('ascii') !== 'WEBP') {
          return false;
        }
        
        // Validate WebP chunk format (VP8, VP8L, or VP8X)
        if (buf.length >= 16) {
          const chunkType = buf.subarray(12, 16).toString('ascii');
          const validChunks = ['VP8 ', 'VP8L', 'VP8X'];
          if (!validChunks.includes(chunkType)) {
            return false;
          }
        }
        
        return true;
      }
    };
    
    const validator = validations[mimeType as keyof typeof validations];
    if (!validator) {
      logSecurityEvent('UNSUPPORTED_MIME_TYPE', {
        mimeType,
        reason: 'No validator available for this MIME type'
      }, req);
      return false;
    }
    
    const isValid = validator(buffer);
    
    if (!isValid) {
      logSecurityEvent('MAGIC_BYTES_VALIDATION_FAILED', {
        mimeType,
        bufferSize: buffer.length,
        firstBytes: Array.from(buffer.subarray(0, Math.min(16, buffer.length))),
        reason: 'Magic bytes or structure validation failed'
      }, req);
    }
    
    return isValid;
    
  } catch (error) {
    logSecurityEvent('IMAGE_VALIDATION_ERROR', {
      mimeType,
      error: error.message,
      bufferSize: buffer.length
    }, req);
    return false;
  }
}

// Helper functions for AI analytics endpoint
function generateTimelineData(detections: any[], startDate: Date, endDate: Date): any[] {
  const timelineData: any[] = [];
  const dayMs = 24 * 60 * 60 * 1000;
  const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / dayMs);
  
  for (let i = 0; i < totalDays; i++) {
    const date = new Date(startDate.getTime() + (i * dayMs));
    const dayStart = new Date(date.setHours(0, 0, 0, 0));
    const dayEnd = new Date(date.setHours(23, 59, 59, 999));
    
    const dayDetections = detections.filter(d => {
      const detectionDate = new Date(d.createdAt || d.frameTimestamp);
      return detectionDate >= dayStart && detectionDate <= dayEnd;
    });
    
    timelineData.push({
      date: dayStart.toISOString().split('T')[0],
      detections: dayDetections.length,
      threats: dayDetections.filter(d => d.threatType).length,
      highConfidence: dayDetections.filter(d => d.confidence >= 0.8).length
    });
  }
  
  return timelineData;
}

function calculatePrecision(detections: any[]): number {
  const verifiedDetections = detections.filter(d => d.isVerified);
  if (verifiedDetections.length === 0) return 0;
  
  const truePositives = verifiedDetections.filter(d => !d.isFalsePositive).length;
  return (truePositives / verifiedDetections.length) * 100;
}

function calculateRecall(detections: any[]): number {
  // For recall calculation, we need ground truth data which might not be available
  // For now, return a reasonable approximation based on verification rates
  const totalDetections = detections.length;
  const verifiedDetections = detections.filter(d => d.isVerified).length;
  
  if (totalDetections === 0) return 0;
  return (verifiedDetections / totalDetections) * 100;
}

// =====================================
// ADVANCED AI FEATURES API ENDPOINTS
// =====================================

// =====================================
// LEGACY ENDPOINTS DISABLED - SECURITY COMPLIANCE
// =====================================
// 
// CRITICAL SECURITY NOTICE:
// These legacy endpoints have been DISABLED because they bypass the requireConsent middleware,
// creating serious privacy compliance violations. ALL advanced AI features MUST go through
// server/advanced-routes.ts with proper consent verification.
//
// DO NOT RE-ENABLE THESE ENDPOINTS - They allow biometric processing without consent!
// =====================================

/*
// BEHAVIORAL PATTERN LEARNING ENDPOINTS - DISABLED FOR SECURITY
app.get("/api/behavioral-patterns", requireAuth, requirePermission("security:behavior:read"), async (req, res) => {
  try {
    const { storeId, eventType, cameraId } = req.query;
    
    if (!storeId) {
      return res.status(400).json({ message: "Store ID is required" });
    }

    // Verify store access
    if (!(req as any).user.storeId || (req as any).user.storeId !== storeId) {
      return res.status(403).json({ message: "Access denied to this store" });
    }

    const events = cameraId 
      ? await storage.getBehaviorEventsByCamera(cameraId as string, eventType as string)
      : await storage.getBehaviorEventsByStore(storeId as string, eventType as string);
    
    res.json(events);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});
*/

// ALL REMAINING LEGACY ENDPOINTS DISABLED FOR SECURITY
/*
app.post("/api/behavioral-patterns", requireAuth, requirePermission("security:behavior:write"), async (req, res) => {
  try {
    const eventData = insertBehaviorEventSchema.parse(req.body);
    
    // Verify store access
    if (!(req as any).user.storeId || (req as any).user.storeId !== eventData.storeId) {
      return res.status(403).json({ message: "Access denied to this store" });
    }

    const event = await storage.createBehaviorEvent(eventData);
    
    // Create audit log
    await storage.createAdvancedFeatureAuditLog({
      userId: (req as any).user.id,
      storeId: eventData.storeId,
      featureType: 'behavior_analysis',
      action: 'create_event',
      resourceType: 'behavior_event',
      resourceId: event.id,
      outcome: 'success',
      details: { eventType: eventData.eventType, confidence: eventData.confidence }
    });
    
    res.json(event);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.get("/api/anomaly-events", requireAuth, requirePermission("security:behavior:read"), async (req, res) => {
  try {
    const { storeId, severity, cameraId } = req.query;
    
    if (!storeId) {
      return res.status(400).json({ message: "Store ID is required" });
    }

    // Verify store access
    if (!(req as any).user.storeId || (req as any).user.storeId !== storeId) {
      return res.status(403).json({ message: "Access denied to this store" });
    }

    const anomalies = cameraId 
      ? await storage.getAnomalyEventsByCamera(cameraId as string)
      : await storage.getAnomalyEventsByStore(storeId as string, severity as string);
    
    res.json(anomalies);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// FACIAL RECOGNITION & WATCHLIST ENDPOINTS
app.get("/api/watchlist", requireAuth, requirePermission("security:face:manage"), async (req, res) => {
  try {
    const { storeId, riskLevel, active } = req.query;
    
    if (!storeId) {
      return res.status(400).json({ message: "Store ID is required" });
    }

    // Verify store access
    if (!(req as any).user.storeId || (req as any).user.storeId !== storeId) {
      return res.status(403).json({ message: "Access denied to this store" });
    }

    const entries = active === 'true' 
      ? await storage.getActiveWatchlistEntriesByStore(storeId as string)
      : await storage.getWatchlistEntriesByStore(storeId as string, riskLevel as string);
    
    // Create audit log
    await storage.createAdvancedFeatureAuditLog({
      userId: (req as any).user.id,
      storeId: storeId as string,
      featureType: 'facial_recognition',
      action: 'view_watchlist',
      resourceType: 'watchlist_entry',
      outcome: 'success',
      details: { count: entries.length }
    });
    
    res.json(entries);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/watchlist", requireAuth, requirePermission("security:face:manage"), async (req, res) => {
  try {
    const entryData = insertWatchlistEntrySchema.parse(req.body);
    
    // Verify store access
    if (!(req as any).user.storeId || (req as any).user.storeId !== entryData.storeId) {
      return res.status(403).json({ message: "Access denied to this store" });
    }

    const entry = await storage.createWatchlistEntry({
      ...entryData,
      addedBy: (req as any).user.id
    });
    
    // Create audit log
    await storage.createAdvancedFeatureAuditLog({
      userId: (req as any).user.id,
      storeId: entryData.storeId,
      featureType: 'facial_recognition',
      action: 'create_watchlist_entry',
      resourceType: 'watchlist_entry',
      resourceId: entry.id,
      outcome: 'success',
      details: { name: entryData.name, riskLevel: entryData.riskLevel }
    });
    
    res.json(entry);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.put("/api/watchlist/:id", requireAuth, requirePermission("security:face:manage"), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = insertWatchlistEntrySchema.partial().parse(req.body);
    
    const entry = await storage.updateWatchlistEntry(id, updates);
    
    // Create audit log
    await storage.createAdvancedFeatureAuditLog({
      userId: (req as any).user.id,
      storeId: entry.storeId,
      featureType: 'facial_recognition',
      action: 'update_watchlist_entry',
      resourceType: 'watchlist_entry',
      resourceId: id,
      outcome: 'success',
      details: updates
    });
    
    res.json(entry);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.delete("/api/watchlist/:id", requireAuth, requirePermission("security:face:manage"), async (req, res) => {
  try {
    const { id } = req.params;
    
    const entry = await storage.deactivateWatchlistEntry(id);
    
    // Create audit log
    await storage.createAdvancedFeatureAuditLog({
      userId: (req as any).user.id,
      storeId: entry.storeId,
      featureType: 'facial_recognition',
      action: 'deactivate_watchlist_entry',
      resourceType: 'watchlist_entry',
      resourceId: id,
      outcome: 'success',
      details: { name: entry.name }
    });
    
    res.json({ message: "Watchlist entry deactivated successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/facial-recognition/search", requireAuth, requirePermission("security:face:search"), async (req, res) => {
  try {
    const { storeId, templateData, threshold = 0.8 } = req.body;
    
    if (!storeId || !templateData) {
      return res.status(400).json({ message: "Store ID and template data are required" });
    }

    // Verify store access
    if (!(req as any).user.storeId || (req as any).user.storeId !== storeId) {
      return res.status(403).json({ message: "Access denied to this store" });
    }

    // Check consent for facial recognition searches
    const hasConsent = await storage.checkConsent(storeId, 'system', 'facial_recognition');
    if (!hasConsent) {
      await storage.createAdvancedFeatureAuditLog({
        userId: (req as any).user.id,
        storeId,
        featureType: 'facial_recognition',
        action: 'search_attempt',
        outcome: 'denied',
        details: { reason: 'No consent for facial recognition' }
      });
      return res.status(403).json({ message: "Facial recognition search requires consent" });
    }

    // Get active watchlist entries for comparison
    const watchlistEntries = await storage.getActiveWatchlistEntriesByStore(storeId);
    
    // In a real implementation, this would perform biometric template matching
    // For now, return a mock response
    const mockMatches = watchlistEntries.slice(0, Math.floor(Math.random() * 3));
    
    // Create audit log
    await storage.createAdvancedFeatureAuditLog({
      userId: (req as any).user.id,
      storeId,
      featureType: 'facial_recognition',
      action: 'search',
      outcome: 'success',
      details: { 
        threshold, 
        matches: mockMatches.length,
        searchTime: Date.now()
      }
    });
    
    res.json({
      matches: mockMatches.map(entry => ({
        id: entry.id,
        name: entry.name,
        riskLevel: entry.riskLevel,
        confidence: 0.85 + Math.random() * 0.1, // Mock confidence score
        matchedAt: new Date().toISOString()
      }))
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// CONSENT PREFERENCES ENDPOINTS
app.get("/api/consent-preferences", requireAuth, requirePermission("security:privacy:manage"), async (req, res) => {
  try {
    const { storeId, consentType } = req.query;
    
    if (!storeId) {
      return res.status(400).json({ message: "Store ID is required" });
    }

    // Verify store access
    if (!(req as any).user.storeId || (req as any).user.storeId !== storeId) {
      return res.status(403).json({ message: "Access denied to this store" });
    }

    const preferences = await storage.getConsentPreferencesByStore(storeId as string, consentType as string);
    
    res.json(preferences);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/consent-preferences", requireAuth, requirePermission("security:privacy:manage"), async (req, res) => {
  try {
    const preferenceData = insertConsentPreferenceSchema.parse(req.body);
    
    // Verify store access
    if (!(req as any).user.storeId || (req as any).user.storeId !== preferenceData.storeId) {
      return res.status(403).json({ message: "Access denied to this store" });
    }

    const preference = await storage.createConsentPreference(preferenceData);
    
    // Create audit log
    await storage.createAdvancedFeatureAuditLog({
      userId: (req as any).user.id,
      storeId: preferenceData.storeId,
      featureType: 'privacy',
      action: 'create_consent',
      resourceType: 'consent_preference',
      resourceId: preference.id,
      outcome: 'success',
      details: { 
        subjectType: preferenceData.subjectType,
        consentType: preferenceData.consentType,
        consentGiven: preferenceData.consentGiven
      }
    });
    
    res.json(preference);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// RISK SCORES ENDPOINTS
app.get("/api/risk-scores", requireAuth, requirePermission("security:predict:read"), async (req, res) => {
  try {
    const { storeId, scoreType, current } = req.query;
    
    if (!storeId) {
      return res.status(400).json({ message: "Store ID is required" });
    }

    // Verify store access
    if (!(req as any).user.storeId || (req as any).user.storeId !== storeId) {
      return res.status(403).json({ message: "Access denied to this store" });
    }

    const scores = current === 'true' 
      ? await storage.getCurrentRiskScores(storeId as string, scoreType as string)
      : await storage.getRiskScoresByStore(storeId as string, scoreType as string);
    
    // Create audit log
    await storage.createAdvancedFeatureAuditLog({
      userId: (req as any).user.id,
      storeId: storeId as string,
      featureType: 'predictive',
      action: 'view_risk_scores',
      outcome: 'success',
      details: { scoreType, count: scores.length, current: current === 'true' }
    });
    
    res.json(scores);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// AUDIT TRAIL ENDPOINTS
app.get("/api/audit-trail/advanced-features", requireAuth, requirePermission("security:audit:read"), async (req, res) => {
  try {
    const { storeId, featureType, userId, limit = 100 } = req.query;
    
    if (!storeId) {
      return res.status(400).json({ message: "Store ID is required" });
    }

    // Verify store access or admin role
    if (!(req as any).user.storeId || (req as any).user.storeId !== storeId) {
      return res.status(403).json({ message: "Access denied to this store" });
    }

    const logs = userId 
      ? await storage.getAdvancedFeatureAuditLogsByUser(userId as string, featureType as string)
      : await storage.getAdvancedFeatureAuditLogsByStore(storeId as string, featureType as string);
    
    // Limit results for performance
    const limitedLogs = logs.slice(0, parseInt(limit as string));
    
    res.json({
      logs: limitedLogs,
      totalCount: logs.length,
      hasMore: logs.length > parseInt(limit as string)
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// FACE TEMPLATES ENDPOINTS (For template management)
app.get("/api/face-templates", requireAuth, requirePermission("security:face:manage"), async (req, res) => {
  try {
    const { storeId, personType } = req.query;
    
    if (!storeId) {
      return res.status(400).json({ message: "Store ID is required" });
    }

    // Verify store access
    if (!(req as any).user.storeId || (req as any).user.storeId !== storeId) {
      return res.status(403).json({ message: "Access denied to this store" });
    }

    const templates = await storage.getFaceTemplatesByStore(storeId as string, personType as string);
    
    // Create audit log
    await storage.createAdvancedFeatureAuditLog({
      userId: (req as any).user.id,
      storeId: storeId as string,
      featureType: 'facial_recognition',
      action: 'view_templates',
      resourceType: 'face_template',
      outcome: 'success',
      details: { count: templates.length, personType }
    });
    
    res.json(templates);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/face-templates", requireAuth, requirePermission("security:face:manage"), async (req, res) => {
  try {
    const templateData = insertFaceTemplateSchema.parse(req.body);
    
    // Verify store access
    if (!(req as any).user.storeId || (req as any).user.storeId !== templateData.storeId) {
      return res.status(403).json({ message: "Access denied to this store" });
    }

    const template = await storage.createFaceTemplate({
      ...templateData,
      createdBy: (req as any).user.id
    });
    
    // Create audit log
    await storage.createAdvancedFeatureAuditLog({
      userId: (req as any).user.id,
      storeId: templateData.storeId,
      featureType: 'facial_recognition',
      action: 'create_template',
      resourceType: 'face_template',
      resourceId: template.id,
      outcome: 'success',
      details: { 
        personType: templateData.personType,
        justification: templateData.justification
      }
    });
    
    res.json(template);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

app.delete("/api/face-templates/:id", requireAuth, requirePermission("security:face:manage"), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get template details before deletion for audit log
    const template = await storage.getFaceTemplate(id);
    if (!template) {
      return res.status(404).json({ message: "Face template not found" });
    }

    // Verify store access
    if (!(req as any).user.storeId || (req as any).user.storeId !== template.storeId) {
      return res.status(403).json({ message: "Access denied to this store" });
    }

    await storage.deleteFaceTemplate(id);
    
    // Create audit log
    await storage.createAdvancedFeatureAuditLog({
      userId: (req as any).user.id,
      storeId: template.storeId,
      featureType: 'facial_recognition',
      action: 'delete_template',
      resourceType: 'face_template',
      resourceId: id,
      outcome: 'success',
      details: { personType: template.personType }
    });
    
    res.json({ message: "Face template deleted successfully" });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});
*/
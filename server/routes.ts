// Penny MVP Routes - Based on javascript_auth_all_persistance & javascript_stripe integrations
import type { Express } from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireStoreStaff, requireStoreAdmin, requirePennyAdmin, requireOffender, requireStoreAccess, requireOffenderAccess, requireSecurityAgent, requireFinanceAgent, requireSalesAgent, requireOperationsAgent, requireHRAgent, requirePlatformRole, requireOrganizationAccess } from "./auth";
import { insertOrganizationSchema, insertAgentSchema, insertUserAgentAccessSchema, insertAgentConfigurationSchema, insertCameraSchema, insertIncidentSchema, offenders } from "../shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

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

  // =====================================
  // STORE UI ENDPOINTS (4 TABS)
  // =====================================

  // MONITOR TAB - Real-time alerts and incident management (Security Agent)
  app.get("/api/store/:storeId/alerts", requireAuth, requireSecurityAgent("viewer"), requireStoreAccess, async (req, res) => {
    try {
      const { storeId } = req.params;
      const alerts = await storage.getActiveAlerts(storeId);
      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get ALL alerts for a store (not just active ones) (Security Agent)
  app.get("/api/alerts/:storeId", requireAuth, requireSecurityAgent("viewer"), requireStoreAccess, async (req, res) => {
    try {
      const { storeId } = req.params;
      const alerts = await storage.getAlertsByStore(storeId);
      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/store/:storeId/alerts/:alertId/confirm", requireAuth, requireSecurityAgent("operator"), requireStoreAccess, async (req, res) => {
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

  app.post("/api/store/:storeId/alerts/:alertId/dismiss", requireAuth, requireSecurityAgent("operator"), requireStoreAccess, async (req, res) => {
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
  app.get("/api/store/:storeId/alerts/priority/:priority", requireAuth, requireSecurityAgent("viewer"), requireStoreAccess, async (req, res) => {
    try {
      const { storeId, priority } = req.params;
      const alerts = await storage.getAlertsByPriority(storeId, priority);
      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/store/:storeId/alerts/status/:status", requireAuth, requireSecurityAgent("viewer"), requireStoreAccess, async (req, res) => {
    try {
      const { storeId, status } = req.params;
      const alerts = await storage.getAlertsByStatus(storeId, status);
      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/store/:storeId/alerts/:alertId/assign", requireAuth, requireSecurityAgent("operator"), requireStoreAccess, async (req, res) => {
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

  app.post("/api/store/:storeId/alerts/:alertId/acknowledge", requireAuth, requireSecurityAgent("operator"), requireStoreAccess, async (req, res) => {
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

  app.post("/api/store/:storeId/alerts/:alertId/escalate", requireAuth, requireSecurityAgent("operator"), requireStoreAccess, async (req, res) => {
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
  app.get("/api/store/:storeId/cameras", requireAuth, requireSecurityAgent("viewer"), requireStoreAccess, async (req, res) => {
    try {
      const { storeId } = req.params;
      const cameras = await storage.getCamerasByStore(storeId);
      res.json(cameras);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/cameras/:cameraId", requireAuth, requireSecurityAgent("viewer"), async (req, res) => {
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

  app.post("/api/store/:storeId/cameras", requireAuth, requireSecurityAgent("admin"), requireStoreAccess, async (req, res) => {
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

  app.post("/api/store/:storeId/cameras/:cameraId/heartbeat", requireAuth, requireSecurityAgent("viewer"), requireStoreAccess, async (req, res) => {
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

  // Incident Management
  app.get("/api/store/:storeId/incidents", requireAuth, requireSecurityAgent("viewer"), requireStoreAccess, async (req, res) => {
    try {
      const { storeId } = req.params;
      const incidents = await storage.getIncidentsByStore(storeId);
      res.json(incidents);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.get("/api/incidents/:incidentId", requireAuth, requireSecurityAgent("viewer"), async (req, res) => {
    try {
      const { incidentId } = req.params;
      const incident = await storage.getIncidentById(incidentId);
      if (!incident) {
        return res.status(404).json({ message: "Incident not found" });
      }
      res.json(incident);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/store/:storeId/incidents", requireAuth, requireSecurityAgent("operator"), requireStoreAccess, async (req, res) => {
    try {
      const { storeId } = req.params;
      
      // Validate request body with Zod
      const validatedData = insertIncidentSchema.parse({ 
        ...req.body, 
        storeId, 
        reportedBy: req.user!.id 
      });
      const incident = await storage.createIncident(validatedData);
      res.status(201).json(incident);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: "Invalid incident data", errors: error.errors });
      }
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/store/:storeId/incidents/:incidentId/assign", requireAuth, requireSecurityAgent("operator"), requireStoreAccess, async (req, res) => {
    try {
      const { storeId, incidentId } = req.params;
      
      // Validate request body
      const { userId } = req.body;
      if (userId && typeof userId !== 'string') {
        return res.status(400).json({ message: "Invalid userId format" });
      }
      
      // Verify incident belongs to this store
      const incident = await storage.getIncidentById(incidentId);
      if (!incident || incident.storeId !== storeId) {
        return res.status(404).json({ message: "Incident not found in this store" });
      }
      
      const updatedIncident = await storage.assignIncident(incidentId, userId || req.user!.id);
      res.json(updatedIncident);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/store/:storeId/incidents/:incidentId/evidence", requireAuth, requireSecurityAgent("operator"), requireStoreAccess, async (req, res) => {
    try {
      const { storeId, incidentId } = req.params;
      const { evidenceFiles } = req.body;
      
      // Validate request body
      if (!evidenceFiles || !Array.isArray(evidenceFiles)) {
        return res.status(400).json({ message: "evidenceFiles array is required" });
      }
      
      // Verify incident belongs to this store
      const incident = await storage.getIncidentById(incidentId);
      if (!incident || incident.storeId !== storeId) {
        return res.status(404).json({ message: "Incident not found in this store" });
      }
      
      const updatedIncident = await storage.addEvidenceToIncident(incidentId, evidenceFiles);
      res.json(updatedIncident);
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

  // Video upload and analysis endpoints
  app.post("/api/store/:storeId/video/analyze", requireAuth, requireStoreStaff, requireStoreAccess, async (req, res) => {
    try {
      const { storeId } = req.params;
      const { videoBase64, cameraId } = req.body;
      
      if (!videoBase64) {
        return res.status(400).json({ message: "Video data is required" });
      }
      
      // Verify store exists and user has access
      const existingStore = await storage.getStore(storeId);
      if (!existingStore) {
        return res.status(404).json({ message: "Store not found" });
      }

      // Validate file size (max 50MB)
      const videoSizeBytes = (videoBase64.length * 3) / 4; // Approximate base64 to bytes
      if (videoSizeBytes > 50 * 1024 * 1024) {
        return res.status(400).json({ message: "Video file too large. Maximum size is 50MB." });
      }

      // Import video analysis service
      const { videoAnalysisService } = await import('./video-analysis');
      
      // Convert base64 to buffer and save
      const videoBuffer = Buffer.from(videoBase64, 'base64');
      const videoPath = await videoAnalysisService.saveUploadedVideo(videoBuffer, 'upload.mp4');
      
      // Analyze video for faces and suspicious activity
      const analysisResult = await videoAnalysisService.analyzeVideo(videoPath, storeId, cameraId);
      
      // Get known offenders for face matching
      const knownOffenders = await storage.getNetworkOffenders();
      
      // Enhanced face matching with proper cropping
      const enhancedMatches: Array<{
        offenderId: string;
        confidence: number;
        faceId: string;
        timestamp: number;
      }> = [];

      for (const face of analysisResult.detectedFaces) {
        if (face.boundingBox && knownOffenders.length > 0) {
          try {
            // Find the frame this face was detected in (simplified for MVP)
            const frameIndex = parseInt(face.id.split('_frame_')[1]) || 0;
            const framePath = `/tmp/frame_${frameIndex}.jpg`; // Would need proper frame mapping
            
            // Crop face from frame using bounding box
            const croppedFacePath = await videoAnalysisService.cropFaceFromFrame(
              framePath, 
              face.boundingBox
            );
            
            // Compare cropped face with known offenders
            const faceMatches = await videoAnalysisService.compareFaceWithOffenders(
              croppedFacePath,
              knownOffenders.map(o => ({
                id: o.id,
                name: o.name || 'Unknown',
                thumbnails: (o.thumbnails as string[]) || []
              }))
            );
            
            faceMatches.forEach(match => {
              enhancedMatches.push({
                offenderId: match.offenderId,
                confidence: match.confidence,
                faceId: face.id,
                timestamp: frameIndex * 2 // Assuming 2-second intervals
              });
            });
            
          } catch (error) {
            console.error('Face processing error:', error);
          }
        }
      }

      // Add enhanced matches to analysis result
      analysisResult.matchedOffenders.push(...enhancedMatches);

      // Create alerts for high-confidence matches
      for (const match of analysisResult.matchedOffenders) {
        if (match.confidence > 0.8) {
          const offender = knownOffenders.find(o => o.id === match.offenderId);
          await storage.createAlert({
            storeId,
            cameraId: cameraId || 'video-upload',
            type: 'known_offender_detected',
            severity: 'high',
            title: 'Known Offender Detected',
            message: `Known offender "${offender?.name || 'Unknown'}" detected in uploaded video with ${(match.confidence * 100).toFixed(1)}% confidence`,
            metadata: {
              offenderId: match.offenderId,
              confidence: match.confidence,
              faceId: match.faceId,
              videoAnalysisId: analysisResult.id
            } as any
          });
        }
      }

      // Store analysis results
      await storage.createVideoAnalysis({
        id: analysisResult.id,
        storeId,
        cameraId: cameraId || null,
        videoFilePath: videoPath,
        analysisStatus: "COMPLETED",
        detectedFaces: analysisResult.detectedFaces,
        matchedOffenders: analysisResult.matchedOffenders,
        confidenceScores: {
          averageFaceConfidence: analysisResult.detectedFaces.length > 0 
            ? analysisResult.detectedFaces.reduce((sum, face) => sum + face.confidence, 0) / analysisResult.detectedFaces.length 
            : 0
        },
        videoDurationSeconds: analysisResult.videoMetadata.duration,
        analyzedAt: new Date()
      });

      res.json({
        analysisId: analysisResult.id,
        detectedFaces: analysisResult.detectedFaces.length,
        matchedOffenders: analysisResult.matchedOffenders.length,
        suspiciousActivities: analysisResult.suspiciousActivity.length,
        highConfidenceMatches: analysisResult.matchedOffenders.filter(m => m.confidence > 0.8).length,
        analysisResult
      });

    } catch (error: any) {
      console.error('Video analysis error:', error);
      res.status(500).json({ message: "Analysis failed: " + error.message });
    }
  });

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
      const salesMetrics = await storage.getSalesMetrics(organizationId);
      const recentDeals = await storage.getRecentCompletedPayments(5, organizationId);
      const paymentsLast30Days = await storage.getPaymentsInLast30Days(organizationId);

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
        time: new Date(incident.detectedAt).toLocaleString()
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
  app.post("/api/seed-demo-data", requireAuth, requirePlatformRole("admin"), async (req, res) => {
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
      const hrMetrics = await storage.getHRMetrics(organizationId);
      
      // Get recent hires (last 30 days)
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

  const httpServer = createServer(app);
  return httpServer;
}
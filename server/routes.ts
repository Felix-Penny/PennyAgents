// Penny MVP Routes - Based on javascript_auth_all_persistance & javascript_stripe integrations
import type { Express } from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import { randomUUID } from "crypto";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireStoreStaff, requireStoreAdmin, requirePennyAdmin, requireOffender, requireStoreAccess, requireOffenderAccess, requireSecurityAgent, requireFinanceAgent, requireSalesAgent, requireOperationsAgent, requireHRAgent, requirePlatformRole, requireOrganizationAccess } from "./auth";
import { insertOrganizationSchema, insertAgentSchema, insertUserAgentAccessSchema, insertAgentConfigurationSchema, insertCameraSchema, insertIncidentSchema } from "../shared/schema";

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
      
      // Enforce store ownership: offender must belong to the requesting store
      if (!offender.storeId || offender.storeId !== storeId) {
        return res.status(404).json({ message: "Offender not found in this store" });
      }
      
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
      
      // Enforce cross-tenant security: offender must belong to same store as alert
      if (!offender.storeId || offender.storeId !== existingAlert.storeId) {
        return res.status(400).json({ message: "Offender does not belong to alert's store" });
      }

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
        incidentTimestamp: alert.detectedAt!,
      });

      // Update offender debt
      if (offender) {
        const newDebt = parseFloat(offender.totalDebt || "0") + parseFloat(amount);
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
      if (!user.offenderId) {
        return res.status(400).json({ message: "No offender profile linked" });
      }

      const thefts = await storage.getTheftsByOffender(user.offenderId);
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
                thumbnails: o.thumbnails || []
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
              analysisId: analysisResult.id,
              offenderId: match.offenderId,
              confidence: match.confidence,
              faceId: match.faceId
            }
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

  const httpServer = createServer(app);
  return httpServer;
}
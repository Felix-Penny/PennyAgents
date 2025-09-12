// Penny MVP Routes - Based on javascript_auth_all_persistance & javascript_stripe integrations
import type { Express } from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import { storage } from "./storage";
import { setupAuth, requireAuth, requireStoreStaff, requireStoreAdmin, requirePennyAdmin, requireOffender, requireStoreAccess, requireOffenderAccess } from "./auth";

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

  // MONITOR TAB - Real-time alerts and incident management
  app.get("/api/store/:storeId/alerts", requireAuth, requireStoreAccess, async (req, res) => {
    try {
      const { storeId } = req.params;
      const alerts = await storage.getActiveAlerts(storeId);
      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  // Get ALL alerts for a store (not just active ones)
  app.get("/api/alerts/:storeId", requireAuth, requireStoreAccess, async (req, res) => {
    try {
      const { storeId } = req.params;
      const alerts = await storage.getAlertsByStore(storeId);
      res.json(alerts);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/store/:storeId/alerts/:alertId/confirm", requireAuth, requireStoreStaff, async (req, res) => {
    try {
      const { alertId } = req.params;
      const alert = await storage.updateAlert(alertId, {
        status: "PENDING_REVIEW",
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
      });
      res.json(alert);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  app.post("/api/store/:storeId/alerts/:alertId/dismiss", requireAuth, requireStoreStaff, async (req, res) => {
    try {
      const { alertId } = req.params;
      const alert = await storage.updateAlert(alertId, {
        status: "DISMISSED",
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
      });
      res.json(alert);
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

  app.post("/api/store/:storeId/offenders/:offenderId/generate-qr", requireAuth, requireStoreStaff, async (req, res) => {
    try {
      const { storeId, offenderId } = req.params;
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

  app.put("/api/store/:storeId/settings", requireAuth, requireStoreAdmin, async (req, res) => {
    try {
      const { storeId } = req.params;
      const updates = req.body;
      const store = await storage.updateStore(storeId, updates);
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

      // Update alert status
      const alert = await storage.updateAlert(alertId, {
        status: "CONFIRMED",
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
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
      const offender = await storage.getOffender(offenderId);
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
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
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

      const { amount, offenderId, theftIds } = req.body;
      
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

  // Video upload for evidence
  app.post("/api/evidence/upload", requireAuth, requireStoreStaff, async (req, res) => {
    try {
      // Handle video/image upload to S3 (placeholder for MVP)
      res.json({ message: "Evidence upload endpoint - to be implemented with S3" });
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
      const notification = await storage.markNotificationRead(id);
      res.json(notification);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
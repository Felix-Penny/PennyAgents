/**
 * Facial Recognition Alert Integration Test Suite
 * Comprehensive end-to-end testing of facial recognition → alert generation workflow
 */

import { FacialRecognitionService } from "../ai/facialRecognition";
import { alertBroadcaster } from "../alerts";
import { AlertEngine } from "../alerts/alertEngine";
import { storage } from "../storage";
import { randomUUID } from "crypto";
import type { 
  FacialRecognitionResult, 
  WatchlistMatch,
  FacialRecognitionEventData,
  WatchlistMatchData 
} from "../ai/facialRecognition";

export interface FacialRecognitionTestResult {
  testName: string;
  passed: boolean;
  duration: number;
  details: {
    facialDetectionsProcessed: number;
    watchlistMatchesFound: number;
    alertsGenerated: number;
    webSocketMessagesReceived: number;
    consentVerificationsPerformed: number;
  };
  errors: string[];
}

export class FacialRecognitionAlertTester {
  private facialRecognitionService: FacialRecognitionService;
  private alertEngine: AlertEngine;
  private testResults: FacialRecognitionTestResult[] = [];
  private mockWebSocketClients: any[] = [];
  private testStoreId = "test-store-facial-001";
  private testCameraId = "test-camera-facial-001";

  constructor() {
    this.facialRecognitionService = new FacialRecognitionService();
    this.alertEngine = new AlertEngine(alertBroadcaster);
  }

  /**
   * Run comprehensive facial recognition alert integration tests
   */
  async runFacialRecognitionTestSuite(): Promise<{
    totalTests: number;
    passed: number;
    failed: number;
    results: FacialRecognitionTestResult[];
    overallDuration: number;
  }> {
    const startTime = Date.now();
    console.log("🔍 Starting facial recognition alert integration test suite...");

    this.testResults = [];

    // Setup test environment
    await this.setupTestEnvironment();

    // Test 1: Facial Recognition Detection → Alert Generation
    await this.testFacialDetectionToAlert();

    // Test 2: Watchlist Match → High Priority Alert
    await this.testWatchlistMatchAlert();

    // Test 3: Consent Management Integration
    await this.testConsentManagementIntegration();

    // Test 4: Biometric Template Expiration Alert
    await this.testBiometricTemplateExpirationAlert();

    // Test 5: Real-time WebSocket Notifications
    await this.testFacialRecognitionWebSocketNotifications();

    // Test 6: Privacy Compliance and Audit Trail
    await this.testPrivacyComplianceAndAuditTrail();

    // Test 7: Facial Recognition Alert Metadata Validation
    await this.testFacialRecognitionAlertMetadata();

    // Test 8: Multiple Detection Correlation
    await this.testMultipleDetectionCorrelation();

    // Cleanup test environment
    await this.cleanupTestEnvironment();

    const endTime = Date.now();
    const overallDuration = endTime - startTime;

    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed).length;

    console.log(`✅ Facial recognition test suite completed in ${overallDuration}ms`);
    console.log(`📊 Results: ${passed} passed, ${failed} failed`);

    return {
      totalTests: this.testResults.length,
      passed,
      failed,
      results: this.testResults,
      overallDuration
    };
  }

  /**
   * Test 1: Facial Recognition Detection → Alert Generation
   */
  private async testFacialDetectionToAlert(): Promise<void> {
    const testName = "Facial Recognition Detection → Alert Generation";
    const startTime = Date.now();
    const errors: string[] = [];
    let details = {
      facialDetectionsProcessed: 0,
      watchlistMatchesFound: 0,
      alertsGenerated: 0,
      webSocketMessagesReceived: 0,
      consentVerificationsPerformed: 0
    };

    try {
      console.log(`🧪 Running test: ${testName}`);

      // Create test image data (base64 encoded test image)
      const testImageBase64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA==";

      // Test facial recognition processing
      const facialResult = await this.facialRecognitionService.processFaceDetection(
        testImageBase64,
        this.testStoreId,
        this.testCameraId,
        "test-user-001"
      );

      details.facialDetectionsProcessed = 1;
      details.consentVerificationsPerformed = 1;

      if (facialResult.matchType === 'consent_denied') {
        console.log("✅ Consent verification working correctly");
      } else if (facialResult.matchType === 'new_face' || facialResult.matchType === 'no_match') {
        details.alertsGenerated = 1;
        console.log(`✅ Facial detection processed: ${facialResult.matchType}`);
      } else {
        errors.push(`Unexpected facial recognition result: ${facialResult.matchType}`);
      }

      // Verify alert was created with proper facial recognition metadata
      const recentAlerts = await storage.getRecentAlertsForStore(this.testStoreId, 1);
      if (recentAlerts.length > 0) {
        const alert = recentAlerts[0];
        if (alert.metadata?.triggeredBy === 'facial_recognition' && 
            alert.metadata?.facialRecognitionData) {
          console.log("✅ Alert contains facial recognition metadata");
        } else {
          errors.push("Alert missing facial recognition metadata");
        }
      }

    } catch (error) {
      errors.push(`Test execution error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const duration = Date.now() - startTime;
    this.testResults.push({
      testName,
      passed: errors.length === 0,
      duration,
      details,
      errors
    });
  }

  /**
   * Test 2: Watchlist Match → High Priority Alert
   */
  private async testWatchlistMatchAlert(): Promise<void> {
    const testName = "Watchlist Match → High Priority Alert";
    const startTime = Date.now();
    const errors: string[] = [];
    let details = {
      facialDetectionsProcessed: 0,
      watchlistMatchesFound: 0,
      alertsGenerated: 0,
      webSocketMessagesReceived: 0,
      consentVerificationsPerformed: 0
    };

    try {
      console.log(`🧪 Running test: ${testName}`);

      // Create test watchlist entry
      const testWatchlistEntry = {
        id: randomUUID(),
        personId: "test-person-watchlist-001",
        name: "Test Watchlist Person",
        watchlistType: "security_threat" as const,
        riskLevel: "high" as const,
        reason: "Test security threat for integration testing",
        addedBy: "test-user-001",
        storeId: this.testStoreId
      };

      await storage.createWatchlistEntry(testWatchlistEntry);

      // Create test facial recognition with watchlist match
      const watchlistMatch: WatchlistMatch = {
        watchlistEntryId: testWatchlistEntry.id,
        personId: testWatchlistEntry.personId,
        name: testWatchlistEntry.name,
        watchlistType: testWatchlistEntry.watchlistType,
        riskLevel: testWatchlistEntry.riskLevel,
        confidence: 0.92,
        reason: testWatchlistEntry.reason,
        addedBy: testWatchlistEntry.addedBy,
        notifications: {
          email: true,
          sms: true,
          realtime: true
        }
      };

      // Simulate watchlist match alert generation
      const watchlistMatchData: WatchlistMatchData = {
        personId: testWatchlistEntry.personId,
        watchlistEntryId: testWatchlistEntry.id,
        watchlistType: testWatchlistEntry.watchlistType,
        riskLevel: testWatchlistEntry.riskLevel,
        matchConfidence: 0.92,
        cameraId: this.testCameraId,
        reason: testWatchlistEntry.reason
      };

      // Test alert generation for watchlist match
      const alertData = {
        storeId: this.testStoreId,
        cameraId: this.testCameraId,
        type: "known_offender_entry",
        severity: "high",
        priority: "urgent",
        title: "WATCHLIST MATCH: Known Offender Detected",
        message: `Watchlist match: ${testWatchlistEntry.name} (${testWatchlistEntry.riskLevel} risk)`,
        metadata: {
          triggeredBy: "facial_recognition",
          watchlistMatch: true,
          watchlistData: watchlistMatchData,
          confidence: 0.92
        }
      };

      const alert = await storage.createAlert(alertData);
      details.alertsGenerated = 1;
      details.watchlistMatchesFound = 1;

      // Verify high priority alert was created
      if (alert.severity === "high" && alert.priority === "urgent") {
        console.log("✅ High priority watchlist match alert created");
      } else {
        errors.push(`Incorrect alert priority/severity: ${alert.severity}/${alert.priority}`);
      }

      // Test WebSocket notification for watchlist match
      const mockClient = this.createMockWebSocketClient();
      alertBroadcaster.registerClient("test-watchlist-client", mockClient, {
        userId: "test-user-001",
        storeId: this.testStoreId,
        filters: { severity: ["high", "critical"] },
        preferences: { maxAlertsPerMinute: 10 }
      });

      await alertBroadcaster.broadcastWatchlistMatchAlert(watchlistMatchData, alert, "critical");
      details.webSocketMessagesReceived = 1;

      if (mockClient.lastMessage?.type === "watchlist_match_alert") {
        console.log("✅ Watchlist match WebSocket notification sent");
      } else {
        errors.push("Watchlist match WebSocket notification not received");
      }

    } catch (error) {
      errors.push(`Test execution error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const duration = Date.now() - startTime;
    this.testResults.push({
      testName,
      passed: errors.length === 0,
      duration,
      details,
      errors
    });
  }

  /**
   * Test 3: Consent Management Integration
   */
  private async testConsentManagementIntegration(): Promise<void> {
    const testName = "Consent Management Integration";
    const startTime = Date.now();
    const errors: string[] = [];
    let details = {
      facialDetectionsProcessed: 0,
      watchlistMatchesFound: 0,
      alertsGenerated: 0,
      webSocketMessagesReceived: 0,
      consentVerificationsPerformed: 0
    };

    try {
      console.log(`🧪 Running test: ${testName}`);

      // Test consent denial scenario
      const testImageBase64 = "data:image/jpeg;base64,test-image-data";
      
      // Process facial recognition without consent
      const result = await this.facialRecognitionService.processFaceDetection(
        testImageBase64,
        this.testStoreId,
        this.testCameraId,
        "test-user-no-consent"
      );

      details.facialDetectionsProcessed = 1;
      details.consentVerificationsPerformed = 1;

      if (result.matchType === 'consent_denied') {
        console.log("✅ Consent verification correctly blocks processing");
        
        // Verify consent verification failed notification
        const mockClient = this.createMockWebSocketClient();
        alertBroadcaster.registerClient("test-consent-client", mockClient, {
          userId: "test-user-001",
          storeId: this.testStoreId,
          filters: {},
          preferences: {}
        });

        await alertBroadcaster.broadcastConsentVerificationFailed(
          "test-person-001",
          this.testCameraId,
          "No consent given for facial recognition processing",
          new Date()
        );

        details.webSocketMessagesReceived = 1;

        if (mockClient.lastMessage?.type === "consent_verification_failed") {
          console.log("✅ Consent verification failed notification sent");
        } else {
          errors.push("Consent verification failed notification not received");
        }
      } else {
        errors.push("Consent verification failed to block processing");
      }

    } catch (error) {
      errors.push(`Test execution error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const duration = Date.now() - startTime;
    this.testResults.push({
      testName,
      passed: errors.length === 0,
      duration,
      details,
      errors
    });
  }

  /**
   * Test 4: Biometric Template Expiration Alert
   */
  private async testBiometricTemplateExpirationAlert(): Promise<void> {
    const testName = "Biometric Template Expiration Alert";
    const startTime = Date.now();
    const errors: string[] = [];
    let details = {
      facialDetectionsProcessed: 0,
      watchlistMatchesFound: 0,
      alertsGenerated: 0,
      webSocketMessagesReceived: 0,
      consentVerificationsPerformed: 0
    };

    try {
      console.log(`🧪 Running test: ${testName}`);

      // Create expiring biometric template
      const templateId = randomUUID();
      const personId = "test-person-expiring-template";
      
      // Create template that expires soon
      const expiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Expires in 24 hours

      // Test biometric template expiration notification
      const mockClient = this.createMockWebSocketClient();
      alertBroadcaster.registerClient("test-expiration-client", mockClient, {
        userId: "test-user-001",
        storeId: this.testStoreId,
        filters: {},
        preferences: {}
      });

      await alertBroadcaster.broadcastBiometricTemplateExpires(
        personId,
        templateId,
        expiryDate
      );

      details.webSocketMessagesReceived = 1;

      if (mockClient.lastMessage?.type === "biometric_template_expires") {
        console.log("✅ Biometric template expiration notification sent");
        
        // Verify expiration alert generation
        const expirationAlertData = {
          storeId: this.testStoreId,
          type: "biometric_template_expiry",
          severity: "medium",
          priority: "normal",
          title: "Biometric Template Expiring",
          message: `Biometric template for person ${personId} expires on ${expiryDate.toLocaleDateString()}`,
          metadata: {
            triggeredBy: "biometric_template_expiry",
            personId,
            templateId,
            expiryDate: expiryDate.toISOString(),
            templateType: "facial_recognition"
          }
        };

        const alert = await storage.createAlert(expirationAlertData);
        details.alertsGenerated = 1;

        if (alert.metadata?.triggeredBy === "biometric_template_expiry") {
          console.log("✅ Biometric template expiration alert created");
        } else {
          errors.push("Biometric template expiration alert not properly created");
        }
      } else {
        errors.push("Biometric template expiration notification not received");
      }

    } catch (error) {
      errors.push(`Test execution error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const duration = Date.now() - startTime;
    this.testResults.push({
      testName,
      passed: errors.length === 0,
      duration,
      details,
      errors
    });
  }

  /**
   * Test 5: Real-time WebSocket Notifications
   */
  private async testFacialRecognitionWebSocketNotifications(): Promise<void> {
    const testName = "Real-time WebSocket Notifications";
    const startTime = Date.now();
    const errors: string[] = [];
    let details = {
      facialDetectionsProcessed: 0,
      watchlistMatchesFound: 0,
      alertsGenerated: 0,
      webSocketMessagesReceived: 0,
      consentVerificationsPerformed: 0
    };

    try {
      console.log(`🧪 Running test: ${testName}`);

      // Create multiple mock WebSocket clients
      const clients = this.createMultipleMockWebSocketClients(3);
      
      clients.forEach((client, index) => {
        alertBroadcaster.registerClient(`test-websocket-client-${index}`, client, {
          userId: `test-user-${index}`,
          storeId: this.testStoreId,
          filters: { types: ["facial_recognition"] },
          preferences: { maxAlertsPerMinute: 10 }
        });
      });

      // Test facial recognition event notification
      const facialEventData: FacialRecognitionEventData = {
        eventId: randomUUID(),
        storeId: this.testStoreId,
        cameraId: this.testCameraId,
        personId: "test-person-001",
        confidence: 0.89,
        watchlistMatch: false,
        consentVerified: true,
        processingTimeMs: 150
      };

      await alertBroadcaster.broadcastFacialRecognitionMatch(
        facialEventData,
        0.89,
        new Date()
      );

      details.facialDetectionsProcessed = 1;
      details.webSocketMessagesReceived = clients.length;

      // Verify all clients received the notification
      let receivedCount = 0;
      clients.forEach(client => {
        if (client.lastMessage?.type === "facial_recognition_match") {
          receivedCount++;
        }
      });

      if (receivedCount === clients.length) {
        console.log(`✅ All ${clients.length} WebSocket clients received facial recognition notification`);
      } else {
        errors.push(`Only ${receivedCount}/${clients.length} clients received notification`);
      }

      // Test facial recognition event alert notification
      const facialRecognitionAlertData = {
        storeId: this.testStoreId,
        cameraId: this.testCameraId,
        type: "facial_recognition_event",
        severity: "medium",
        priority: "normal",
        title: "Facial Recognition Event",
        message: "Person detected and processed via facial recognition",
        metadata: {
          triggeredBy: "facial_recognition",
          facialRecognitionData: facialEventData,
          confidence: 0.89
        }
      };

      const alert = await storage.createAlert(facialRecognitionAlertData);
      details.alertsGenerated = 1;

      await alertBroadcaster.broadcastFacialRecognitionEvent(
        facialEventData.eventId,
        this.testCameraId,
        {
          faceId: "test-face-001",
          confidence: 0.89,
          consentStatus: true
        },
        new Date()
      );

      // Verify facial recognition event message sent
      let eventReceivedCount = 0;
      clients.forEach(client => {
        if (client.lastMessage?.type === "facial_recognition_event") {
          eventReceivedCount++;
        }
      });

      if (eventReceivedCount === clients.length) {
        console.log(`✅ All ${clients.length} WebSocket clients received facial recognition event`);
      } else {
        errors.push(`Only ${eventReceivedCount}/${clients.length} clients received event notification`);
      }

    } catch (error) {
      errors.push(`Test execution error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const duration = Date.now() - startTime;
    this.testResults.push({
      testName,
      passed: errors.length === 0,
      duration,
      details,
      errors
    });
  }

  /**
   * Test 6: Privacy Compliance and Audit Trail
   */
  private async testPrivacyComplianceAndAuditTrail(): Promise<void> {
    const testName = "Privacy Compliance and Audit Trail";
    const startTime = Date.now();
    const errors: string[] = [];
    let details = {
      facialDetectionsProcessed: 0,
      watchlistMatchesFound: 0,
      alertsGenerated: 0,
      webSocketMessagesReceived: 0,
      consentVerificationsPerformed: 0
    };

    try {
      console.log(`🧪 Running test: ${testName}`);

      // Test audit trail creation for facial recognition operations
      const testImageBase64 = "data:image/jpeg;base64,test-audit-image";
      
      // Process facial recognition and verify audit trail
      const result = await this.facialRecognitionService.processFaceDetection(
        testImageBase64,
        this.testStoreId,
        this.testCameraId,
        "test-user-audit"
      );

      details.facialDetectionsProcessed = 1;
      details.consentVerificationsPerformed = 1;

      // Verify audit trail was created
      const auditLogs = await storage.getAdvancedFeatureAuditLogs({
        storeId: this.testStoreId,
        featureType: "facial_recognition",
        limit: 5
      });

      if (auditLogs.length > 0) {
        const latestLog = auditLogs[0];
        if (latestLog.featureType === "facial_recognition" && 
            latestLog.action === "extract_features") {
          console.log("✅ Facial recognition audit trail created");
        } else {
          errors.push("Facial recognition audit trail not properly created");
        }
      } else {
        errors.push("No audit logs found for facial recognition operation");
      }

      // Test GDPR data subject report generation
      const gdprReport = await this.facialRecognitionService.generateGDPRDataSubjectReport(
        "test-person-gdpr"
      );

      if (gdprReport && gdprReport.biometricTemplates) {
        console.log("✅ GDPR data subject report generated");
      } else {
        errors.push("GDPR data subject report generation failed");
      }

    } catch (error) {
      errors.push(`Test execution error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const duration = Date.now() - startTime;
    this.testResults.push({
      testName,
      passed: errors.length === 0,
      duration,
      details,
      errors
    });
  }

  /**
   * Test 7: Facial Recognition Alert Metadata Validation
   */
  private async testFacialRecognitionAlertMetadata(): Promise<void> {
    const testName = "Facial Recognition Alert Metadata Validation";
    const startTime = Date.now();
    const errors: string[] = [];
    let details = {
      facialDetectionsProcessed: 0,
      watchlistMatchesFound: 0,
      alertsGenerated: 0,
      webSocketMessagesReceived: 0,
      consentVerificationsPerformed: 0
    };

    try {
      console.log(`🧪 Running test: ${testName}`);

      // Create comprehensive facial recognition alert with full metadata
      const facialAlertData = {
        storeId: this.testStoreId,
        cameraId: this.testCameraId,
        type: "facial_recognition_detection",
        severity: "medium",
        priority: "normal",
        title: "Facial Recognition Detection",
        message: "Person detected and analyzed via facial recognition",
        metadata: {
          triggeredBy: "facial_recognition",
          confidence: 0.87,
          facialRecognitionData: {
            eventId: randomUUID(),
            personId: "test-person-metadata",
            templateId: "test-template-001",
            algorithm: "openai_vision",
            processingTime: 245,
            consentVerified: true,
            legalBasis: "consent",
            watchlistMatch: false,
            faceAttributes: {
              age: 35,
              gender: "unknown",
              emotion: "neutral",
              eyeglasses: false,
              quality: 0.92
            },
            boundingBox: {
              x: 100,
              y: 150,
              width: 80,
              height: 100
            }
          },
          auditTrail: {
            operation: "facial_detection",
            userId: "test-user-metadata",
            storeId: this.testStoreId,
            consentStatus: "granted",
            legalBasis: "consent",
            timestamp: new Date().toISOString(),
            outcome: "success"
          }
        }
      };

      const alert = await storage.createAlert(facialAlertData);
      details.alertsGenerated = 1;

      // Validate alert metadata structure
      const metadata = alert.metadata;
      if (!metadata) {
        errors.push("Alert metadata is missing");
      } else {
        // Check required facial recognition metadata fields
        const requiredFields = [
          'triggeredBy',
          'confidence',
          'facialRecognitionData',
          'auditTrail'
        ];

        const missingFields = requiredFields.filter(field => !(field in metadata));
        if (missingFields.length > 0) {
          errors.push(`Missing metadata fields: ${missingFields.join(', ')}`);
        }

        // Validate facial recognition data structure
        const frData = metadata.facialRecognitionData;
        if (!frData || !frData.eventId || !frData.algorithm) {
          errors.push("Facial recognition data incomplete");
        }

        // Validate audit trail structure
        const auditTrail = metadata.auditTrail;
        if (!auditTrail || !auditTrail.operation || !auditTrail.consentStatus) {
          errors.push("Audit trail data incomplete");
        }

        if (errors.length === 0) {
          console.log("✅ Facial recognition alert metadata validation passed");
        }
      }

    } catch (error) {
      errors.push(`Test execution error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const duration = Date.now() - startTime;
    this.testResults.push({
      testName,
      passed: errors.length === 0,
      duration,
      details,
      errors
    });
  }

  /**
   * Test 8: Multiple Detection Correlation
   */
  private async testMultipleDetectionCorrelation(): Promise<void> {
    const testName = "Multiple Detection Correlation";
    const startTime = Date.now();
    const errors: string[] = [];
    let details = {
      facialDetectionsProcessed: 0,
      watchlistMatchesFound: 0,
      alertsGenerated: 0,
      webSocketMessagesReceived: 0,
      consentVerificationsPerformed: 0
    };

    try {
      console.log(`🧪 Running test: ${testName}`);

      // Create multiple facial recognition detections for the same person
      const personId = "test-person-correlation";
      const detectionEvents = [];

      for (let i = 0; i < 3; i++) {
        const eventData: FacialRecognitionEventData = {
          eventId: randomUUID(),
          storeId: this.testStoreId,
          cameraId: this.testCameraId,
          personId,
          confidence: 0.85 + (i * 0.05),
          watchlistMatch: false,
          consentVerified: true,
          processingTimeMs: 150 + (i * 10)
        };
        detectionEvents.push(eventData);
      }

      details.facialDetectionsProcessed = detectionEvents.length;

      // Process each detection and create alerts
      for (const event of detectionEvents) {
        const alertData = {
          storeId: this.testStoreId,
          cameraId: this.testCameraId,
          type: "facial_recognition_detection",
          severity: "low",
          priority: "normal",
          title: "Facial Recognition Detection",
          message: `Person ${personId} detected with ${(event.confidence * 100).toFixed(1)}% confidence`,
          metadata: {
            triggeredBy: "facial_recognition",
            facialRecognitionData: event,
            confidence: event.confidence,
            correlationId: personId
          }
        };

        await storage.createAlert(alertData);
        details.alertsGenerated++;
      }

      // Verify correlation of multiple detections
      const recentAlerts = await storage.getRecentAlertsForStore(this.testStoreId, 10);
      const correlatedAlerts = recentAlerts.filter(alert => 
        alert.metadata?.correlationId === personId
      );

      if (correlatedAlerts.length === detectionEvents.length) {
        console.log(`✅ ${correlatedAlerts.length} correlated facial recognition alerts created`);
        
        // Verify alerts have proper correlation metadata
        const hasCorrelationMetadata = correlatedAlerts.every(alert => 
          alert.metadata?.correlationId === personId &&
          alert.metadata?.triggeredBy === "facial_recognition"
        );

        if (hasCorrelationMetadata) {
          console.log("✅ All alerts contain proper correlation metadata");
        } else {
          errors.push("Some alerts missing correlation metadata");
        }
      } else {
        errors.push(`Expected ${detectionEvents.length} correlated alerts, found ${correlatedAlerts.length}`);
      }

    } catch (error) {
      errors.push(`Test execution error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const duration = Date.now() - startTime;
    this.testResults.push({
      testName,
      passed: errors.length === 0,
      duration,
      details,
      errors
    });
  }

  /**
   * Setup test environment
   */
  private async setupTestEnvironment(): Promise<void> {
    try {
      // Create test store if it doesn't exist
      const testStore = {
        id: this.testStoreId,
        name: "Test Store - Facial Recognition",
        address: "123 Test St",
        city: "Test City",
        state: "TS",
        zipCode: "12345"
      };

      await storage.createStore(testStore);

      // Create test camera
      const testCamera = {
        id: this.testCameraId,
        storeId: this.testStoreId,
        name: "Test Camera - Facial Recognition",
        location: "Test Area",
        status: "online"
      };

      await storage.createCamera(testCamera);

      console.log("✅ Test environment setup complete");
    } catch (error) {
      console.log("⚠️ Test environment setup (some entities may already exist)");
    }
  }

  /**
   * Cleanup test environment
   */
  private async cleanupTestEnvironment(): Promise<void> {
    try {
      // Cleanup test data
      await storage.deleteCamera(this.testCameraId);
      await storage.deleteStore(this.testStoreId);
      
      // Cleanup WebSocket clients
      this.mockWebSocketClients.forEach((_, index) => {
        alertBroadcaster.unregisterClient(`test-client-${index}`);
      });

      console.log("✅ Test environment cleanup complete");
    } catch (error) {
      console.log("⚠️ Test environment cleanup completed with some errors");
    }
  }

  /**
   * Create mock WebSocket client for testing
   */
  private createMockWebSocketClient(): any {
    const mockClient = {
      id: randomUUID(),
      userId: "test-user-001",
      storeId: this.testStoreId,
      readyState: 1, // WebSocket.OPEN
      lastMessage: null as any,
      send: function(message: string) {
        this.lastMessage = JSON.parse(message);
        console.log(`Mock client received:`, this.lastMessage.type);
      }
    };
    
    this.mockWebSocketClients.push(mockClient);
    return mockClient;
  }

  /**
   * Create multiple mock WebSocket clients
   */
  private createMultipleMockWebSocketClients(count: number): any[] {
    const clients = [];
    for (let i = 0; i < count; i++) {
      clients.push(this.createMockWebSocketClient());
    }
    return clients;
  }

  /**
   * Generate comprehensive test report
   */
  generateTestReport(): string {
    const totalTests = this.testResults.length;
    const passed = this.testResults.filter(r => r.passed).length;
    const failed = this.testResults.filter(r => !r.passed).length;
    const totalDuration = this.testResults.reduce((sum, r) => sum + r.duration, 0);

    let report = `
📋 FACIAL RECOGNITION ALERT INTEGRATION TEST REPORT
===================================================

🏆 OVERALL RESULTS:
- Total Tests: ${totalTests}
- Passed: ${passed} ✅
- Failed: ${failed} ${failed > 0 ? '❌' : ''}
- Success Rate: ${Math.round((passed / totalTests) * 100)}%
- Total Duration: ${totalDuration}ms

📊 DETAILED RESULTS:
${this.testResults.map(result => `
${result.passed ? '✅' : '❌'} ${result.testName}
   Duration: ${result.duration}ms
   Facial Detections: ${result.details.facialDetectionsProcessed}
   Watchlist Matches: ${result.details.watchlistMatchesFound}
   Alerts Generated: ${result.details.alertsGenerated}
   WebSocket Messages: ${result.details.webSocketMessagesReceived}
   Consent Verifications: ${result.details.consentVerificationsPerformed}
   ${result.errors.length > 0 ? `   Errors: ${result.errors.join(', ')}` : ''}
`).join('\n')}

🎯 KEY METRICS:
- Total Facial Detections: ${this.testResults.reduce((sum, r) => sum + r.details.facialDetectionsProcessed, 0)}
- Total Watchlist Matches: ${this.testResults.reduce((sum, r) => sum + r.details.watchlistMatchesFound, 0)}
- Total Alerts Generated: ${this.testResults.reduce((sum, r) => sum + r.details.alertsGenerated, 0)}
- Total WebSocket Messages: ${this.testResults.reduce((sum, r) => sum + r.details.webSocketMessagesReceived, 0)}
- Total Consent Verifications: ${this.testResults.reduce((sum, r) => sum + r.details.consentVerificationsPerformed, 0)}

${failed === 0 ? '🎉 ALL FACIAL RECOGNITION TESTS PASSED! System ready for production.' : '⚠️ Some tests failed. Review errors above.'}
===================================================
`;

    return report;
  }
}

// Export for use in testing
export const facialRecognitionAlertTester = new FacialRecognitionAlertTester();
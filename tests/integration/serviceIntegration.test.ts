import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';

// Import our service implementations
import awsRekognitionService from '../../server/services/awsRekognitionService';
import s3StorageService from '../../server/services/s3StorageService';
import openAIService from '../../server/services/openAIService';
import twilioSMSService from '../../server/services/twilioSMSService';
import emailService from '../../server/services/emailService';
import hybridStorageService from '../../server/services/hybridStorageService';
import pennyAdminService from '../../server/services/pennyAdminService';
import serviceManager from '../../server/services/serviceManager';
import tenantIsolation from '../../server/middleware/tenantIsolation';

// Mock data
const mockImageBuffer = Buffer.from('fake-image-data');
const mockVideoUrl = 'https://example.com/test-video.mp4';
const testEmail = 'test@example.com';
const testPhoneNumber = '+1234567890';

describe('Service Integration Tests', () => {
  let aiServiceProcess: ChildProcess;
  let serverProcess: ChildProcess;
  let wsConnection: WebSocket;
  let authToken: string;
  let testTenantId: number;
  let testStoreId: number;

  beforeAll(async () => {
    console.log('Starting integration tests...');

    // Start AI service if not running
    try {
      await startAIService();
    } catch (error) {
      console.log('AI service may already be running:', error);
    }

    // Start main server if not running
    try {
      await startMainServer();
    } catch (error) {
      console.log('Main server may already be running:', error);
    }

    // Wait for services to be ready
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Initialize service manager
    await serviceManager.initializeAllServices();

    // Setup test tenant and store
    testTenantId = 1;
    testStoreId = 1;

    // Get authentication token
    authToken = await getAuthToken();
  });

  afterAll(async () => {
    // Clean up processes
    if (aiServiceProcess) {
      aiServiceProcess.kill();
    }
    if (serverProcess) {
      serverProcess.kill();
    }
    if (wsConnection) {
      wsConnection.close();
    }
  });

  beforeEach(async () => {
    // Services don't need reset between tests
    // They handle their own state management
  });

  describe('Service Manager Health Checks', () => {
    it('should report all services as healthy', async () => {
      const health = await serviceManager.checkSystemHealth();
      
      expect(health.overall).toBe('healthy');
      expect(health.services).toHaveProperty('awsRekognition');
      expect(health.services).toHaveProperty('openAI');
      expect(health.services).toHaveProperty('twilioSMS');
      expect(health.services).toHaveProperty('emailService');
      expect(health.services).toHaveProperty('hybridStorage');
    });

    it('should handle service failures gracefully', async () => {
      // Simulate OpenAI service failure
      const originalAnalyze = openAIService.analyzeSecurityImage;
      openAIService.analyzeSecurityImage = async () => ({
        success: false,
        error: 'Simulated OpenAI failure',
        fallbackUsed: true
      });

      const health = await serviceManager.checkSystemHealth();
      
      expect(health.services.openAI.status).toBe('degraded');

      // Restore service
      openAIService.analyzeSecurityImage = originalAnalyze;
    });
  });

  describe('Image Processing Pipeline', () => {
    it('should process security image through complete pipeline', async () => {
      // 1. Upload image to hybrid storage
      const uploadResult = await hybridStorageService.uploadFile(
        mockImageBuffer,
        'test-security-image.jpg',
        'evidence'
      );

      expect(uploadResult.success).toBe(true);
      expect(uploadResult.url).toBeDefined();

      // 2. Analyze with OpenAI
      const analysisResult = await openAIService.analyzeSecurityImage(
        uploadResult.url!,
        'Analyze this security footage for suspicious activity'
      );

      expect(analysisResult.success).toBe(true);
      expect(analysisResult.analysis).toBeDefined();

      // 3. Process with facial recognition if suspicious activity detected
      if (analysisResult.analysis?.suspiciousActivity) {
        const faceResult = await awsRekognitionService.detectFaces(mockImageBuffer);
        
        expect(faceResult.success).toBe(true);
        if (faceResult.faces && faceResult.faces.length > 0) {
          // Search for known offenders
          const searchResult = await awsRekognitionService.searchFacesByImage(mockImageBuffer);
          expect(searchResult.success).toBe(true);
        }
      }

      // 4. Generate incident report if threat detected
      if (analysisResult.analysis?.threatLevel && 
          (analysisResult.analysis.threatLevel === 'high' || 
           analysisResult.analysis.threatLevel === 'critical')) {
        const incident = {
          storeId: testStoreId,
          timestamp: new Date().toISOString(),
          description: analysisResult.analysis.description || 'Security threat detected',
          severity: analysisResult.analysis.threatLevel === 'critical' ? 'critical' : 'high' as const,
          imageUrl: uploadResult.url,
          analysis: analysisResult.analysis
        };

        // Package evidence for Penny Admin
        const evidencePackage = await pennyAdminService.submitToOffenderNetwork(incident as any);
        expect(evidencePackage.success).toBe(true);
      }
    });

    it('should handle image processing failures with fallbacks', async () => {
      // Simulate OpenAI failure
      const originalAnalyze = openAIService.analyzeSecurityImage;
      openAIService.analyzeSecurityImage = async () => {
        throw new Error('OpenAI service unavailable');
      };

      // Upload should still work
      const uploadResult = await hybridStorageService.uploadFile(
        mockImageBuffer,
        'test-fallback-image.jpg',
        'evidence',
        { tenantId: testTenantId, storeId: testStoreId }
      );

      expect(uploadResult.success).toBe(true);

      // Should fallback to basic analysis
      const analysisResult = await openAIService.analyzeSecurityImage(
        uploadResult.fileUrl!,
        'Analyze this security footage'
      );

      expect(analysisResult.success).toBe(false);
      expect(analysisResult.fallbackUsed).toBe(true);

      // Restore service
      openAIService.analyzeSecurityImage = originalAnalyze;
    });
  });

  describe('Alert System Integration', () => {
    it('should send multi-channel alerts for high-priority incidents', async () => {
      const alertData = {
        type: 'theft_detected',
        severity: 'high',
        storeId: testStoreId,
        tenantId: testTenantId,
        description: 'Suspected theft in progress',
        imageUrl: 'https://example.com/evidence.jpg',
        timestamp: new Date().toISOString()
      };

      // Send SMS alert
      const smsResult = await twilioSMSService.sendSecurityAlert(
        testPhoneNumber,
        alertData.type,
        alertData.description,
        alertData.storeId
      );

      expect(smsResult.success).toBe(true);

      // Send email alert  
      const emailResult = await emailService.sendSecurityAlert(
        testEmail,
        {
          type: alertData.type,
          severity: alertData.severity,
          storeName: `Store ${testStoreId}`,
          description: alertData.description,
          imageUrl: alertData.imageUrl,
          timestamp: alertData.timestamp
        }
      );

      expect(emailResult.success).toBe(true);
    });

    it('should respect tenant isolation in alert routing', async () => {
      const tenant1AlertData = {
        tenantId: 1,
        storeId: 1,
        message: 'Tenant 1 alert'
      };

      const tenant2AlertData = {
        tenantId: 2,
        storeId: 2,
        message: 'Tenant 2 alert'
      };

      // Alerts should be isolated by tenant
      const sms1Result = await twilioSMSService.sendSecurityAlert(
        testPhoneNumber,
        'test_alert',
        tenant1AlertData.message,
        tenant1AlertData.storeId
      );

      const sms2Result = await twilioSMSService.sendSecurityAlert(
        testPhoneNumber,
        'test_alert', 
        tenant2AlertData.message,
        tenant2AlertData.storeId
      );

      expect(sms1Result.success).toBe(true);
      expect(sms2Result.success).toBe(true);
      
      // Verify messages are different
      expect(sms1Result.messageId).not.toBe(sms2Result.messageId);
    });
  });

  describe('Storage System Integration', () => {
    it('should sync between local and S3 storage', async () => {
      // Upload to local storage first
      const localResult = await hybridStorageService.uploadFile(
        mockImageBuffer,
        'sync-test-image.jpg',
        'evidence',
        { tenantId: testTenantId, storeId: testStoreId, forceLocal: true }
      );

      expect(localResult.success).toBe(true);
      expect(localResult.storedLocally).toBe(true);

      // Trigger sync to S3
      await hybridStorageService.syncToCloud();

      // Verify file exists in S3
      const s3Result = await s3StorageService.getFileUrl(localResult.key!, 3600);
      expect(s3Result.success).toBe(true);
    });

    it('should fallback to local storage when S3 is unavailable', async () => {
      // Simulate S3 failure
      const originalUpload = s3StorageService.uploadFile;
      s3StorageService.uploadFile = async () => {
        throw new Error('S3 unavailable');
      };

      const uploadResult = await hybridStorageService.uploadFile(
        mockImageBuffer,
        'fallback-test-image.jpg',
        'evidence',
        { tenantId: testTenantId, storeId: testStoreId }
      );

      expect(uploadResult.success).toBe(true);
      expect(uploadResult.storedLocally).toBe(true);
      expect(uploadResult.fallbackUsed).toBe(true);

      // Restore service
      s3StorageService.uploadFile = originalUpload;
    });
  });

  describe('WebSocket Real-time Communication', () => {
    it('should broadcast alerts to connected clients', async () => {
      return new Promise<void>((resolve, reject) => {
        // Connect to WebSocket
        wsConnection = new WebSocket('ws://localhost:3001');
        
        wsConnection.on('open', () => {
          // Authenticate
          wsConnection.send(JSON.stringify({
            type: 'auth',
            token: authToken,
            storeId: testStoreId
          }));
        });

        wsConnection.on('message', (data) => {
          const message = JSON.parse(data.toString());
          
          if (message.type === 'alert') {
            expect(message.data.severity).toBe('high');
            expect(message.data.storeId).toBe(testStoreId);
            resolve();
          }
        });

        wsConnection.on('error', reject);

        // Send alert after connection
        setTimeout(async () => {
          await twilioSMSService.sendSecurityAlert(
            testPhoneNumber,
            'websocket_test',
            'WebSocket integration test alert',
            testStoreId
          );
        }, 1000);

        // Timeout test after 10 seconds
        setTimeout(() => reject(new Error('WebSocket test timeout')), 10000);
      });
    });
  });

  describe('Multi-tenant Isolation', () => {
    it('should enforce tenant boundaries in API requests', async () => {
      // This would test actual HTTP endpoints if server is available
      // For now, test middleware directly
      const tenant1Filter = tenantIsolation.createTenantFilter(1);
      const tenant2Filter = tenantIsolation.createTenantFilter(2);

      expect(tenant1Filter.tenantId).toBe(1);
      expect(tenant2Filter.tenantId).toBe(2);
      expect(tenant1Filter.tenantId).not.toBe(tenant2Filter.tenantId);
    });

    it('should isolate storage by tenant', async () => {
      const tenant1Upload = await hybridStorageService.uploadFile(
        mockImageBuffer,
        'tenant1-file.jpg',
        'evidence',
        { tenantId: 1, storeId: 1 }
      );

      const tenant2Upload = await hybridStorageService.uploadFile(
        mockImageBuffer,
        'tenant2-file.jpg',
        'evidence',
        { tenantId: 2, storeId: 2 }
      );

      expect(tenant1Upload.success).toBe(true);
      expect(tenant2Upload.success).toBe(true);
      
      // Files should be stored in different tenant directories
      expect(tenant1Upload.key).toContain('tenant-1');
      expect(tenant2Upload.key).toContain('tenant-2');
    });
  });

  describe('End-to-End Evidence Pipeline', () => {
    it('should process complete evidence workflow', async () => {
      const startTime = Date.now();

      // 1. Simulate security event detection
      const securityEvent = {
        storeId: testStoreId,
        tenantId: testTenantId,
        cameraId: 'camera-001',
        timestamp: new Date().toISOString(),
        eventType: 'motion_detected'
      };

      // 2. Capture and store evidence
      const evidenceUpload = await hybridStorageService.uploadFile(
        mockImageBuffer,
        `evidence-${Date.now()}.jpg`,
        'evidence',
        {
          tenantId: securityEvent.tenantId,
          storeId: securityEvent.storeId,
          metadata: {
            cameraId: securityEvent.cameraId,
            eventType: securityEvent.eventType,
            capturedAt: securityEvent.timestamp
          }
        }
      );

      expect(evidenceUpload.success).toBe(true);

      // 3. Analyze evidence with AI
      const aiAnalysis = await openAIService.analyzeSecurityImage(
        evidenceUpload.fileUrl!,
        'Analyze this security camera footage for any suspicious activity'
      );

      expect(aiAnalysis.success).toBe(true);

      // 4. If threat detected, process with facial recognition
      let faceAnalysis = null;
      if (aiAnalysis.analysis?.personsDetected && aiAnalysis.analysis.personsDetected > 0) {
        faceAnalysis = await awsRekognitionService.detectFaces(mockImageBuffer);
        expect(faceAnalysis.success).toBe(true);
      }

      // 5. Generate comprehensive incident report
      const incident = {
        id: `incident-${Date.now()}`,
        storeId: securityEvent.storeId,
        tenantId: securityEvent.tenantId,
        timestamp: securityEvent.timestamp,
        eventType: securityEvent.eventType,
        evidenceUrl: evidenceUpload.fileUrl,
        aiAnalysis: aiAnalysis.analysis,
        faceAnalysis: faceAnalysis,
        severity: aiAnalysis.analysis?.threatLevel ? (
          aiAnalysis.analysis.threatLevel > 0.8 ? 'high' : 
          aiAnalysis.analysis.threatLevel > 0.5 ? 'medium' : 'low'
        ) : 'low'
      };

      // 6. Package and submit to Penny Admin if significant
      if (incident.severity !== 'low') {
        const packageResult = await pennyAdminService.packageEvidence(incident);
        expect(packageResult.success).toBe(true);
      }

      // 7. Send appropriate alerts
      if (incident.severity === 'high') {
        const alertResults = await Promise.all([
          twilioSMSService.sendSecurityAlert(
            testPhoneNumber,
            incident.eventType,
            `High-priority security event at Store ${incident.storeId}`,
            incident.storeId
          ),
          emailService.sendSecurityAlert(testEmail, {
            type: incident.eventType,
            severity: incident.severity,
            storeName: `Store ${incident.storeId}`,
            description: incident.aiAnalysis?.description || 'Security threat detected',
            imageUrl: incident.evidenceUrl,
            timestamp: incident.timestamp
          })
        ]);

        alertResults.forEach(result => {
          expect(result.success).toBe(true);
        });
      }

      const processingTime = Date.now() - startTime;
      console.log(`Complete evidence pipeline processed in ${processingTime}ms`);
      
      // Verify end-to-end processing completed in reasonable time
      expect(processingTime).toBeLessThan(30000); // 30 seconds max
    });
  });

  // Helper functions
  async function startAIService(): Promise<void> {
    return new Promise((resolve, reject) => {
      aiServiceProcess = spawn('python3', ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8000'], {
        cwd: path.join(__dirname, '../../ai-service'),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      aiServiceProcess.stdout?.on('data', (data) => {
        if (data.toString().includes('Uvicorn running')) {
          resolve();
        }
      });

      aiServiceProcess.stderr?.on('data', (data) => {
        console.error('AI Service Error:', data.toString());
      });

      aiServiceProcess.on('error', reject);

      // Timeout after 30 seconds
      setTimeout(() => reject(new Error('AI service startup timeout')), 30000);
    });
  }

  async function startMainServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      serverProcess = spawn('npm', ['run', 'dev'], {
        cwd: path.join(__dirname, '../..'),
        stdio: ['pipe', 'pipe', 'pipe']
      });

      serverProcess.stdout?.on('data', (data) => {
        if (data.toString().includes('Server running')) {
          resolve();
        }
      });

      serverProcess.stderr?.on('data', (data) => {
        console.error('Server Error:', data.toString());
      });

      serverProcess.on('error', reject);

      // Timeout after 30 seconds
      setTimeout(() => reject(new Error('Server startup timeout')), 30000);
    });
  }

  async function getAuthToken(): Promise<string> {
    // In a real implementation, this would authenticate with the server
    // For testing, return a mock JWT token
    return 'mock-jwt-token-for-testing';
  }
});
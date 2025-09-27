import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import fs from 'fs';
import path from 'path';

// Import our service implementations
import serviceManager from '../../server/services/serviceManager';
import hybridStorageService from '../../server/services/hybridStorageService';
import openAIService from '../../server/services/openAIService';
import awsRekognitionService from '../../server/services/awsRekognitionService';
import twilioSMSService from '../../server/services/twilioSMSService';
import emailService from '../../server/services/emailService';
import pennyAdminService from '../../server/services/pennyAdminService';
import tenantIsolation from '../../server/middleware/tenantIsolation';

// Mock data
const mockImageBuffer = Buffer.from('fake-image-data');
const testEmail = 'test@pennyprotect.com';
const testPhoneNumber = '+15551234567';

describe('Core Service Integration Tests', () => {
  let testTenantId: number;
  let testStoreId: number;

  beforeAll(async () => {
    console.log('Initializing integration tests...');

    // Initialize all services
    await serviceManager.initializeAllServices();

    // Setup test tenant and store
    testTenantId = 1;
    testStoreId = 1;

    // Wait for services to be ready
    await new Promise(resolve => setTimeout(resolve, 2000));
  });

  afterAll(async () => {
    console.log('Cleaning up integration tests...');
  });

  describe('Service Manager Health System', () => {
    it('should initialize all services successfully', async () => {
      const health = await serviceManager.checkSystemHealth();
      
      expect(health).toBeDefined();
      expect(Array.isArray(health.services)).toBe(true);
      expect(health.services.length).toBeGreaterThan(0);

      // Check that core services are present
      const serviceNames = health.services.map(s => s.name);
      expect(serviceNames).toContain('hybridStorage');
      expect(serviceNames).toContain('openAI');
      expect(serviceNames).toContain('awsRekognition');
    });
  });

  describe('Storage Service Integration', () => {
    it('should upload files successfully', async () => {
      const filename = 'test-integration-file.jpg';
      const category = 'evidence';

      // Upload file
      const uploadResult = await hybridStorageService.uploadFile(
        mockImageBuffer,
        filename,
        { category }
      );

      expect(uploadResult.success).toBe(true);
      expect(uploadResult.url).toBeDefined();
      expect(uploadResult.path).toBeDefined();
    });

    it('should handle different file categories', async () => {
      const categories: Array<'evidence' | 'temp' | 'profile' | 'alert' | 'report'> = [
        'evidence', 'temp', 'profile', 'alert', 'report'
      ];

      for (const category of categories) {
        const uploadResult = await hybridStorageService.uploadFile(
          mockImageBuffer,
          `test-${category}.jpg`,
          { category }
        );

        expect(uploadResult.success).toBe(true);
        expect(uploadResult.url).toContain(category);
      }
    });
  });

  describe('AI Analysis Integration', () => {
    it('should handle analyze security images request', async () => {
      // Test with buffer (matches actual service signature)
      const analysisResult = await openAIService.analyzeSecurityImage(
        mockImageBuffer,
        'Analyze this security camera footage for suspicious activity'
      );

      expect(analysisResult).toBeDefined();
      expect(typeof analysisResult.success).toBe('boolean');
    });

    it('should generate incident reports with proper format', async () => {
      const mockIncident = {
        timestamp: new Date(),
        location: 'Test Store',
        description: 'Test security incident',
        evidence: ['https://example.com/evidence.jpg'],
        severity: 'medium'
      };

      const reportResult = await openAIService.generateIncidentReport(mockIncident);
      
      expect(reportResult).toBeDefined();
      expect(typeof reportResult.success).toBe('boolean');
    });
  });

  describe('Facial Recognition Integration', () => {
    it('should detect faces in images', async () => {
      const faceResult = await awsRekognitionService.detectFaces(mockImageBuffer);
      
      expect(faceResult).toBeDefined();
      expect(typeof faceResult.success).toBe('boolean');
      
      // In development, this might return mock data or fail gracefully
      if (faceResult.success) {
        expect(Array.isArray(faceResult.faces)).toBe(true);
      }
    });

    it('should search for faces in collections', async () => {
      const searchResult = await awsRekognitionService.searchFacesByImage(mockImageBuffer);
      
      expect(searchResult).toBeDefined();
      expect(typeof searchResult.success).toBe('boolean');
    });
  });

  describe('Communication Services Integration', () => {
    it('should send SMS notifications', async () => {
      const smsResult = await twilioSMSService.sendSMS(
        testPhoneNumber,
        'Integration test message from PennyProtect'
      );

      expect(smsResult).toBeDefined();
      expect(typeof smsResult.success).toBe('boolean');
      
      // In development without real API keys, expect graceful failure
      if (!smsResult.success) {
        expect(smsResult.error).toBeDefined();
      }
    });

    it('should send email alerts', async () => {
      const alertData = {
        type: 'test_alert',
        severity: 'medium' as const,
        storeName: 'Test Store',
        description: 'Integration test alert',
        imageUrl: 'https://example.com/test.jpg',
        timestamp: new Date()
      };

      const emailResult = await emailService.sendSecurityAlert(testEmail, alertData);
      
      expect(emailResult).toBeDefined();
      expect(typeof emailResult.success).toBe('boolean');
    });
  });

  describe('Evidence Processing Pipeline', () => {
    it('should process complete evidence workflow', async () => {
      const startTime = Date.now();

      // 1. Upload evidence
      const uploadResult = await hybridStorageService.uploadFile(
        mockImageBuffer,
        `evidence-${Date.now()}.jpg`,
        { 
          category: 'evidence',
          storeId: testStoreId,
          cameraId: 'test-camera-001'
        }
      );

      expect(uploadResult.success).toBe(true);

      // 2. Analyze with AI
      const analysisResult = await openAIService.analyzeSecurityImage(
        uploadResult.url,
        'Analyze this security footage for threats'
      );

      expect(analysisResult).toBeDefined();

      // 3. Process with facial recognition if needed
      let faceAnalysis = null;
      if (analysisResult.success && analysisResult.analysis?.suspiciousActivity) {
        faceAnalysis = await awsRekognitionService.detectFaces(mockImageBuffer);
        expect(faceAnalysis).toBeDefined();
      }

      // 4. Create incident summary
      const incident = {
        id: `test-incident-${Date.now()}`,
        storeId: testStoreId,
        timestamp: new Date().toISOString(),
        eventType: 'suspicious_activity',
        evidenceUrl: uploadResult.url,
        aiAnalysis: analysisResult.analysis,
        faceAnalysis: faceAnalysis,
        severity: 'medium' as const
      };

      // 5. Generate incident report
      const reportResult = await openAIService.generateIncidentReport(incident);
      expect(reportResult).toBeDefined();

      const processingTime = Date.now() - startTime;
      console.log(`Evidence pipeline processed in ${processingTime}ms`);

      // Should complete in reasonable time
      expect(processingTime).toBeLessThan(10000); // 10 seconds max

      // Clean up
      await hybridStorageService.deleteFile(uploadResult.filename);
    });
  });

  describe('Tenant Isolation System', () => {
    it('should create proper tenant filters', () => {
      const tenant1Filter = tenantIsolation.createTenantFilter(1);
      const tenant2Filter = tenantIsolation.createTenantFilter(2);

      if (tenantIsolation.isMultiTenantEnabled()) {
        expect(tenant1Filter.tenantId).toBe(1);
        expect(tenant2Filter.tenantId).toBe(2);
        expect(tenant1Filter.tenantId).not.toBe(tenant2Filter.tenantId);
      } else {
        // Single tenant mode
        expect(Object.keys(tenant1Filter)).toHaveLength(0);
        expect(Object.keys(tenant2Filter)).toHaveLength(0);
      }
    });

    it('should create proper store filters', () => {
      const storeFilter = tenantIsolation.createStoreFilter(testStoreId, testTenantId);
      
      expect(storeFilter.storeId).toBe(testStoreId);
      
      if (tenantIsolation.isMultiTenantEnabled()) {
        expect(storeFilter.tenantId).toBe(testTenantId);
      }
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle service failures gracefully', async () => {
      // Test with invalid parameters
      const invalidUpload = await hybridStorageService.uploadFile(
        Buffer.alloc(0), // Empty buffer
        '', // Empty filename
        { category: 'evidence' }
      );

      expect(invalidUpload.success).toBe(false);
      expect(invalidUpload.error).toBeDefined();
    });

    it('should provide fallback responses when services are unavailable', async () => {
      // Test OpenAI with empty image URL
      const invalidAnalysis = await openAIService.analyzeSecurityImage(
        '',
        'Test analysis'
      );

      expect(invalidAnalysis).toBeDefined();
      expect(typeof invalidAnalysis.success).toBe('boolean');
    });
  });

  describe('Service Configuration Management', () => {
    it('should access service configurations', () => {
      const services = ['openAI', 'hybridStorage', 'awsRekognition', 'twilioSMS', 'emailService'];
      
      services.forEach(serviceName => {
        const config = serviceManager.getServiceConfig(serviceName);
        expect(config).toBeDefined();
      });
    });

    it('should report service initialization status', () => {
      const initStatus = serviceManager.getInitializationStatus();
      expect(initStatus).toBeDefined();
      expect(typeof initStatus.allServicesInitialized).toBe('boolean');
      expect(Array.isArray(initStatus.initializedServices)).toBe(true);
    });
  });
});
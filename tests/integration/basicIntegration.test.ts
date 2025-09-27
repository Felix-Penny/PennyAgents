import { describe, it, expect, beforeAll } from '@jest/globals';

// Import our service implementations
import serviceManager from '../../server/services/serviceManager';
import hybridStorageService from '../../server/services/hybridStorageService';
import openAIService from '../../server/services/openAIService';
import awsRekognitionService from '../../server/services/awsRekognitionService';
import twilioSMSService from '../../server/services/twilioSMSService';
import emailService from '../../server/services/emailService';
import tenantIsolation from '../../server/middleware/tenantIsolation';

// Mock data
const mockImageBuffer = Buffer.from('fake-image-data');
const testEmail = 'test@pennyprotect.com';

describe('Service Integration Tests', () => {
  beforeAll(async () => {
    console.log('Initializing integration tests...');
    await serviceManager.initializeAllServices();
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  describe('Service Manager', () => {
    it('should check system health', async () => {
      const health = await serviceManager.checkSystemHealth();
      expect(health).toBeDefined();
      expect(Array.isArray(health.services)).toBe(true);
      expect(health.services.length).toBeGreaterThan(0);
    });
  });

  describe('Storage Service', () => {
    it('should upload files', async () => {
      const uploadResult = await hybridStorageService.uploadFile(
        mockImageBuffer,
        'test-file.jpg',
        { category: 'evidence' }
      );

      expect(uploadResult.success).toBe(true);
      expect(uploadResult.url).toBeDefined();
    });
  });

  describe('AI Services', () => {
    it('should analyze security images', async () => {
      const analysisResult = await openAIService.analyzeSecurityImage(
        mockImageBuffer,
        'Test analysis prompt'
      );

      expect(analysisResult).toBeDefined();
      expect(typeof analysisResult.success).toBe('boolean');
    });

    it('should generate incident reports', async () => {
      const incident = {
        timestamp: new Date(),
        location: 'Test Store',
        description: 'Test incident',
        evidence: ['test.jpg'],
        severity: 'medium'
      };

      const reportResult = await openAIService.generateIncidentReport(incident);
      expect(reportResult).toBeDefined();
      expect(typeof reportResult.success).toBe('boolean');
    });
  });

  describe('AWS Rekognition', () => {
    it('should detect faces', async () => {
      const faceResult = await awsRekognitionService.detectFaces(mockImageBuffer);
      expect(faceResult).toBeDefined();
      expect(typeof faceResult.success).toBe('boolean');
    });

    it('should search faces', async () => {
      const searchResult = await awsRekognitionService.searchFacesByImage(mockImageBuffer);
      expect(searchResult).toBeDefined();
      expect(typeof searchResult.success).toBe('boolean');
    });
  });

  describe('Communication Services', () => {
    it('should send SMS', async () => {
      const smsMessage = {
        to: '+15551234567',
        body: 'Test message from integration test'
      };
      
      const smsResult = await twilioSMSService.sendSMS(smsMessage);
      expect(smsResult).toBeDefined();
      expect(typeof smsResult.success).toBe('boolean');
    });

    it('should send security alerts', async () => {
      const alertData = {
        alertType: 'test_alert',
        location: 'Test Store',
        timestamp: new Date(),
        severity: 'medium' as const,
        description: 'Test alert',
        dashboardUrl: 'https://example.com/dashboard'
      };

      const emailResult = await emailService.sendSecurityAlert(testEmail, alertData);
      expect(emailResult).toBeDefined();
      expect(typeof emailResult.success).toBe('boolean');
    });
  });

  describe('Tenant Isolation', () => {
    it('should create tenant filters', () => {
      const filter1 = tenantIsolation.createTenantFilter(1);
      const filter2 = tenantIsolation.createTenantFilter(2);

      expect(filter1).toBeDefined();
      expect(filter2).toBeDefined();
    });

    it('should create store filters', () => {
      const storeFilter = tenantIsolation.createStoreFilter(1, 1);
      expect(storeFilter).toBeDefined();
      expect(storeFilter.storeId).toBe(1);
    });
  });

  describe('End-to-End Workflow', () => {
    it('should process complete security workflow', async () => {
      const startTime = Date.now();

      // 1. Upload evidence
      const uploadResult = await hybridStorageService.uploadFile(
        mockImageBuffer,
        `evidence-${Date.now()}.jpg`,
        { category: 'evidence' }
      );

      expect(uploadResult.success).toBe(true);

      // 2. Analyze with AI
      const analysisResult = await openAIService.analyzeSecurityImage(
        mockImageBuffer,
        'Analyze for security threats'
      );

      expect(analysisResult).toBeDefined();

      // 3. Process with facial recognition
      const faceResult = await awsRekognitionService.detectFaces(mockImageBuffer);
      expect(faceResult).toBeDefined();

      // 4. Generate report if needed
      if (analysisResult.success && analysisResult.analysis) {
        const incident = {
          timestamp: new Date(),
          location: 'Test Store',
          description: analysisResult.analysis.description,
          evidence: [uploadResult.url || 'test.jpg'],
          severity: 'medium'
        };

        const reportResult = await openAIService.generateIncidentReport(incident);
        expect(reportResult).toBeDefined();
      }

      const processingTime = Date.now() - startTime;
      console.log(`Workflow completed in ${processingTime}ms`);
      expect(processingTime).toBeLessThan(30000); // 30 second timeout
    });
  });
});
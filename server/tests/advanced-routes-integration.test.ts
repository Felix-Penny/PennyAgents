// Advanced Routes Integration Tests - Consent Enforcement Validation
// Tests for advanced AI features with privacy compliance and consent requirements

import express from 'express';
import request from 'supertest';
import { registerRoutes } from '../routes';
import { storage } from '../storage';

// Mock dependencies
jest.mock('../storage');
jest.mock('../auth');
jest.mock('../consent-middleware');
jest.mock('../audit-logging');
jest.mock('../biometric-encryption');

const mockedStorage = storage as jest.Mocked<typeof storage>;

describe('Advanced Routes Integration Tests', () => {
  let app: express.Application;
  let server: any;

  beforeEach(() => {
    // Create fresh Express app for each test
    app = express();
    app.use(express.json());
    
    // Register all routes (including advanced routes)
    server = registerRoutes(app);
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (server) {
      server.close();
    }
  });

  // =====================================
  // 1. ROUTE REGISTRATION VALIDATION
  // =====================================

  describe('Route Registration Verification', () => {
    test('Advanced routes should be properly mounted', async () => {
      // Test that advanced routes respond (even if with auth errors)
      // This confirms the routes are registered and accessible
      
      const behaviorPatternsResponse = await request(app)
        .get('/api/store/test-store/behavioral-patterns');
      
      const faceTemplatesResponse = await request(app)
        .get('/api/store/test-store/face-templates');
      
      const faceSearchResponse = await request(app)
        .post('/api/store/test-store/face-search');
      
      // Routes should exist (not 404) - they should fail with auth/consent errors
      expect(behaviorPatternsResponse.status).not.toBe(404);
      expect(faceTemplatesResponse.status).not.toBe(404);
      expect(faceSearchResponse.status).not.toBe(404);
    });
  });

  // =====================================
  // 2. LEGACY ROUTE SAFETY TESTS
  // =====================================

  describe('Legacy Unsafe Routes Protection', () => {
    test('Legacy behavioral patterns endpoint returns 404', async () => {
      // Old unsafe endpoint without store context should not exist
      const response = await request(app)
        .get('/api/behavioral-patterns');
      
      expect(response.status).toBe(404);
    });

    test('Legacy face recognition endpoints return 404', async () => {
      // Test various old unsafe endpoint patterns
      const endpoints = [
        '/api/face-templates',
        '/api/face-search', 
        '/api/biometric-templates',
        '/api/facial-recognition'
      ];

      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);
        expect(response.status).toBe(404);
      }
    });

    test('Global biometric endpoints without consent return 404', async () => {
      // Ensure no global biometric endpoints exist
      const response = await request(app)
        .post('/api/biometric-search')
        .send({ template: 'test-template' });
      
      expect(response.status).toBe(404);
    });
  });

  // =====================================
  // 3. CONSENT ENFORCEMENT TESTS
  // =====================================

  describe('Consent Enforcement - 403 Without Consent', () => {
    beforeEach(() => {
      // Mock authentication middleware to pass but consent to fail
      const authModule = require('../auth');
      const consentModule = require('../consent-middleware');
      
      // Mock successful authentication
      authModule.requireAuth.mockImplementation((req: any, res: any, next: any) => {
        req.user = { id: 'test-user-id', storeId: 'test-store' };
        next();
      });
      
      authModule.requireStoreAccess.mockImplementation((req: any, res: any, next: any) => {
        next();
      });
      
      authModule.requirePermission.mockImplementation(() => 
        (req: any, res: any, next: any) => next()
      );

      // Mock consent middleware to deny consent
      consentModule.requireConsent.mockImplementation(() =>
        (req: any, res: any, next: any) => {
          return res.status(403).json({
            error: "Consent required for this operation",
            consentType: "behavior_analysis",
            reason: "No consent found for user",
            howToProvideConsent: "Contact store management to provide consent for this operation"
          });
        }
      );
    });

    test('Behavioral patterns endpoint returns 403 without consent', async () => {
      const response = await request(app)
        .get('/api/store/test-store/behavioral-patterns')
        .set('Authorization', 'Bearer valid-token-without-consent');
      
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('consent');
      expect(response.body.consentType).toBeDefined();
      expect(response.body.howToProvideConsent).toBeDefined();
    });

    test('Face templates endpoint returns 403 without consent', async () => {
      const response = await request(app)
        .get('/api/store/test-store/face-templates')
        .set('Authorization', 'Bearer valid-token-without-consent');
      
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('consent');
    });

    test('Face search endpoint returns 403 without consent', async () => {
      const response = await request(app)
        .post('/api/store/test-store/face-search')
        .set('Authorization', 'Bearer valid-token-without-consent')
        .send({ searchTemplate: 'test-template', threshold: 0.8 });
      
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('consent');
    });

    test('Face template creation returns 403 without consent', async () => {
      const response = await request(app)
        .post('/api/store/test-store/face-templates')
        .set('Authorization', 'Bearer valid-token-without-consent')
        .send({
          template: 'test-biometric-template',
          personType: 'employee',
          justification: 'Security access control'
        });
      
      expect(response.status).toBe(403);
      expect(response.body.error).toContain('consent');
    });
  });

  // =====================================
  // 4. CONSENT ENFORCEMENT TESTS - SUCCESS CASES
  // =====================================

  describe('Consent Enforcement - 200 With Proper Consent', () => {
    beforeEach(() => {
      // Mock authentication and consent to succeed
      const authModule = require('../auth');
      const consentModule = require('../consent-middleware');
      const auditModule = require('../audit-logging');
      
      // Mock successful authentication
      authModule.requireAuth.mockImplementation((req: any, res: any, next: any) => {
        req.user = { id: 'test-user-id', storeId: 'test-store' };
        next();
      });
      
      authModule.requireStoreAccess.mockImplementation((req: any, res: any, next: any) => {
        next();
      });
      
      authModule.requirePermission.mockImplementation(() => 
        (req: any, res: any, next: any) => next()
      );

      // Mock consent middleware to allow access
      consentModule.requireConsent.mockImplementation(() =>
        (req: any, res: any, next: any) => {
          req.consentInfo = {
            consentType: 'behavior_analysis',
            legalBasis: 'consent',
            consentDate: new Date(),
            subjectType: 'employee'
          };
          next();
        }
      );

      // Mock audit logging
      auditModule.auditHelpers = {
        behaviorAnalysis: jest.fn().mockResolvedValue(undefined),
        facialRecognition: jest.fn().mockResolvedValue(undefined)
      };

      // Mock storage responses
      mockedStorage.getBehaviorEventsByStore.mockResolvedValue([]);
      mockedStorage.createBehaviorEvent.mockResolvedValue({
        id: 'test-event-id',
        storeId: 'test-store',
        eventType: 'suspicious_behavior',
        confidence: 0.95,
        area: 'entrance',
        timestamp: new Date()
      });
      mockedStorage.getFaceTemplatesByStore.mockResolvedValue([]);
      mockedStorage.createFaceTemplate.mockResolvedValue({
        id: 'test-template-id',
        storeId: 'test-store',
        personType: 'employee',
        encryptedTemplate: 'encrypted-data',
        keyId: 'test-key-id',
        createdAt: new Date()
      });
    });

    test('Behavioral patterns endpoint allows access with consent', async () => {
      const response = await request(app)
        .get('/api/store/test-store/behavioral-patterns')
        .set('Authorization', 'Bearer valid-token-with-consent');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Verify audit logging was called
      const auditModule = require('../audit-logging');
      expect(auditModule.auditHelpers.behaviorAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({ user: expect.objectContaining({ id: 'test-user-id' }) }),
        'RETRIEVE',
        'SUCCESS',
        expect.any(Object)
      );
    });

    test('Behavior event creation works with consent', async () => {
      const eventData = {
        eventType: 'suspicious_behavior',
        confidence: 0.85,
        area: 'checkout',
        detectedBy: 'ai_system'
      };

      const response = await request(app)
        .post('/api/store/test-store/behavioral-patterns')
        .set('Authorization', 'Bearer valid-token-with-consent')
        .send(eventData);
      
      expect(response.status).toBe(200);
      expect(response.body.id).toBe('test-event-id');
      expect(response.body.eventType).toBe('suspicious_behavior');
      
      // Verify storage was called with correct data
      expect(mockedStorage.createBehaviorEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          ...eventData,
          storeId: 'test-store'
        })
      );
    });

    test('Face templates endpoint allows access with consent', async () => {
      const response = await request(app)
        .get('/api/store/test-store/face-templates')
        .set('Authorization', 'Bearer valid-token-with-consent');
      
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Verify audit logging was called
      const auditModule = require('../audit-logging');
      expect(auditModule.auditHelpers.facialRecognition).toHaveBeenCalledWith(
        expect.objectContaining({ user: expect.objectContaining({ id: 'test-user-id' }) }),
        'RETRIEVE',
        'SUCCESS',
        expect.any(Object)
      );
    });
  });

  // =====================================
  // 5. AUDIT LOGGING VALIDATION
  // =====================================

  describe('Audit Logging Verification', () => {
    beforeEach(() => {
      // Setup successful auth and consent but focus on audit logging
      const authModule = require('../auth');
      const consentModule = require('../consent-middleware');
      const auditModule = require('../audit-logging');
      
      authModule.requireAuth.mockImplementation((req: any, res: any, next: any) => {
        req.user = { id: 'audit-test-user', storeId: 'audit-test-store' };
        next();
      });
      
      authModule.requireStoreAccess.mockImplementation((req: any, res: any, next: any) => {
        next();
      });
      
      authModule.requirePermission.mockImplementation(() => 
        (req: any, res: any, next: any) => next()
      );

      consentModule.requireConsent.mockImplementation(() =>
        (req: any, res: any, next: any) => next()
      );

      // Mock audit helpers
      auditModule.auditHelpers = {
        behaviorAnalysis: jest.fn().mockResolvedValue(undefined),
        facialRecognition: jest.fn().mockResolvedValue(undefined)
      };

      mockedStorage.getBehaviorEventsByStore.mockResolvedValue([
        { id: '1', eventType: 'loitering', confidence: 0.9 },
        { id: '2', eventType: 'suspicious_behavior', confidence: 0.85 }
      ]);
    });

    test('Behavioral analysis access is properly audited', async () => {
      await request(app)
        .get('/api/store/audit-test-store/behavioral-patterns?area=entrance')
        .set('Authorization', 'Bearer valid-token');
      
      const auditModule = require('../audit-logging');
      expect(auditModule.auditHelpers.behaviorAnalysis).toHaveBeenCalledWith(
        expect.objectContaining({
          user: expect.objectContaining({ id: 'audit-test-user' }),
          params: expect.objectContaining({ storeId: 'audit-test-store' })
        }),
        'RETRIEVE',
        'SUCCESS',
        expect.objectContaining({
          eventCount: 2,
          area: 'entrance'
        })
      );
    });

    test('Failed operations are audited with error details', async () => {
      // Mock storage to throw error
      mockedStorage.getBehaviorEventsByStore.mockRejectedValue(new Error('Database connection failed'));
      
      await request(app)
        .get('/api/store/audit-test-store/behavioral-patterns')
        .set('Authorization', 'Bearer valid-token');
      
      const auditModule = require('../audit-logging');
      expect(auditModule.auditHelpers.behaviorAnalysis).toHaveBeenCalledWith(
        expect.any(Object),
        'RETRIEVE',
        'ERROR',
        expect.objectContaining({
          error: 'Database connection failed'
        })
      );
    });
  });

  // =====================================
  // 6. BIOMETRIC SECURITY VALIDATION  
  // =====================================

  describe('Biometric Security Integration', () => {
    beforeEach(() => {
      // Setup mocks for biometric operations
      const authModule = require('../auth');
      const consentModule = require('../consent-middleware');
      const biometricModule = require('../biometric-encryption');
      const auditModule = require('../audit-logging');
      
      authModule.requireAuth.mockImplementation((req: any, res: any, next: any) => {
        req.user = { id: 'biometric-test-user', storeId: 'biometric-test-store' };
        next();
      });
      
      authModule.requireStoreAccess.mockImplementation((req: any, res: any, next: any) => {
        next();
      });
      
      authModule.requirePermission.mockImplementation(() => 
        (req: any, res: any, next: any) => next()
      );

      // Only allow facial recognition consent (strictest requirement)
      consentModule.requireConsent.mockImplementation(() =>
        (req: any, res: any, next: any) => {
          req.consentInfo = {
            consentType: 'facial_recognition',
            legalBasis: 'consent',
            consentDate: new Date(),
            subjectType: 'employee'
          };
          next();
        }
      );

      // Mock biometric utilities
      biometricModule.biometricUtils = {
        createEncryptedTemplate: jest.fn().mockResolvedValue({
          storeId: 'biometric-test-store',
          encryptedTemplate: 'mock-encrypted-template-data',
          keyId: 'mock-key-id',
          personType: 'employee',
          justification: 'Access control',
          retentionDays: 90
        })
      };

      // Mock audit helpers
      auditModule.auditHelpers = {
        facialRecognition: jest.fn().mockResolvedValue(undefined)
      };

      mockedStorage.createFaceTemplate.mockResolvedValue({
        id: 'biometric-template-id',
        storeId: 'biometric-test-store',
        encryptedTemplate: 'mock-encrypted-template-data',
        keyId: 'mock-key-id',
        personType: 'employee',
        createdAt: new Date()
      });
    });

    test('Face template creation uses proper encryption', async () => {
      const templateData = {
        template: 'raw-biometric-template-data',
        personType: 'employee',
        justification: 'Security access control',
        retentionDays: 30
      };

      const response = await request(app)
        .post('/api/store/biometric-test-store/face-templates')
        .set('Authorization', 'Bearer valid-token-with-facial-consent')
        .send(templateData);
      
      expect(response.status).toBe(200);
      expect(response.body.id).toBe('biometric-template-id');
      expect(response.body.encryptedTemplate).toBe('[ENCRYPTED]'); // Should hide actual data
      
      // Verify encryption was called
      const biometricModule = require('../biometric-encryption');
      expect(biometricModule.biometricUtils.createEncryptedTemplate).toHaveBeenCalledWith(
        'biometric-test-store',
        'raw-biometric-template-data',
        'employee',
        'biometric-test-user',
        'Security access control',
        30
      );
      
      // Verify audit logging
      const auditModule = require('../audit-logging');
      expect(auditModule.auditHelpers.facialRecognition).toHaveBeenCalledWith(
        expect.any(Object),
        'CREATE',
        'SUCCESS',
        expect.objectContaining({
          templateId: 'biometric-template-id',
          personType: 'employee',
          retentionDays: 30
        })
      );
    });

    test('Biometric template data is never exposed in responses', async () => {
      mockedStorage.getFaceTemplatesByStore.mockResolvedValue([
        {
          id: 'template-1',
          storeId: 'biometric-test-store',
          encryptedTemplate: 'sensitive-encrypted-biometric-data',
          keyId: 'key-1',
          personType: 'employee',
          createdAt: new Date()
        }
      ]);

      const response = await request(app)
        .get('/api/store/biometric-test-store/face-templates')
        .set('Authorization', 'Bearer valid-token-with-facial-consent');
      
      expect(response.status).toBe(200);
      expect(response.body[0].encryptedTemplate).toBe('[ENCRYPTED]');
      expect(response.body[0].encryptedTemplate).not.toBe('sensitive-encrypted-biometric-data');
    });
  });

  // =====================================
  // 7. COMPREHENSIVE COMPLIANCE VALIDATION
  // =====================================

  describe('Privacy Compliance Validation', () => {
    test('No advanced endpoints bypass consent requirements', async () => {
      // Test various potential bypass routes
      const bypassAttempts = [
        '/api/store/test/behavioral-patterns',
        '/api/store/test/face-templates', 
        '/api/store/test/face-search',
        '/api/store/test/biometric-data',
        '/api/store/test/predictive-analytics'
      ];

      for (const endpoint of bypassAttempts) {
        const response = await request(app)
          .get(endpoint)
          .set('Authorization', 'Bearer mock-token');
        
        // Should either be 404 (route doesn't exist) or require authentication/consent
        expect([403, 404, 401]).toContain(response.status);
      }
    });

    test('All biometric operations require explicit consent', async () => {
      // Mock to reject consent for biometric operations
      const consentModule = require('../consent-middleware');
      consentModule.requireConsent.mockImplementation(() =>
        (req: any, res: any, next: any) => {
          return res.status(403).json({
            error: "Explicit consent required for biometric processing",
            consentType: "facial_recognition"
          });
        }
      );

      const biometricEndpoints = [
        { method: 'GET', path: '/api/store/test/face-templates' },
        { method: 'POST', path: '/api/store/test/face-templates' },
        { method: 'POST', path: '/api/store/test/face-search' }
      ];

      for (const endpoint of biometricEndpoints) {
        const response = await request(app)[endpoint.method.toLowerCase() as 'get' | 'post'](endpoint.path)
          .set('Authorization', 'Bearer valid-token')
          .send({});
        
        expect(response.status).toBe(403);
        expect(response.body.error).toContain('consent');
      }
    });
  });
});
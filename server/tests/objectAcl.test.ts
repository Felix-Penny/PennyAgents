// Unit tests for Object ACL enforcement across different roles
// Tests the critical ACL functionality to ensure production readiness

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { canAccessObject, ObjectPermission, ObjectAccessGroupType, ObjectAclPolicy } from '../objectAcl';
import { File } from '@google-cloud/storage';

// Mock the storage module
jest.mock('../storage', () => ({
  storage: {
    getUser: jest.fn(),
    getUserAgentsByUser: jest.fn(),
  }
}));

// Mock Google Cloud Storage File with proper Jest mock typing
const mockGetMetadata = jest.fn() as jest.MockedFunction<any>;
const mockExists = jest.fn() as jest.MockedFunction<any>;
const mockSetMetadata = jest.fn() as jest.MockedFunction<any>;

const mockFile = {
  getMetadata: mockGetMetadata,
  exists: mockExists,
  setMetadata: mockSetMetadata,
} as unknown as File;

// Mock storage
const { storage } = require('../storage');

describe('Object ACL Enforcement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('canAccessObject', () => {
    it('should allow access to public objects for read permission', async () => {
      const aclPolicy: ObjectAclPolicy = {
        owner: 'owner-user-id',
        visibility: 'public',
        aclRules: []
      };

      mockGetMetadata.mockResolvedValue([{
        metadata: {
          'custom:aclPolicy': JSON.stringify(aclPolicy)
        }
      }]);

      const canAccess = await canAccessObject({
        userId: 'any-user-id',
        objectFile: mockFile,
        requestedPermission: ObjectPermission.READ
      });

      expect(canAccess).toBe(true);
    });

    it('should deny access to public objects for write permission without proper ACL', async () => {
      const aclPolicy: ObjectAclPolicy = {
        owner: 'owner-user-id',
        visibility: 'public',
        aclRules: []
      };

      mockGetMetadata.mockResolvedValue([{
        metadata: {
          'custom:aclPolicy': JSON.stringify(aclPolicy)
        }
      }]);

      const canAccess = await canAccessObject({
        userId: 'any-user-id',
        objectFile: mockFile,
        requestedPermission: ObjectPermission.WRITE
      });

      expect(canAccess).toBe(false);
    });

    it('should allow object owner full access', async () => {
      const ownerId = 'owner-user-id';
      const aclPolicy: ObjectAclPolicy = {
        owner: ownerId,
        visibility: 'private',
        aclRules: []
      };

      mockGetMetadata.mockResolvedValue([{
        metadata: {
          'custom:aclPolicy': JSON.stringify(aclPolicy)
        }
      }]);

      const canAccessRead = await canAccessObject({
        userId: ownerId,
        objectFile: mockFile,
        requestedPermission: ObjectPermission.READ
      });

      const canAccessWrite = await canAccessObject({
        userId: ownerId,
        objectFile: mockFile,
        requestedPermission: ObjectPermission.WRITE
      });

      expect(canAccessRead).toBe(true);
      expect(canAccessWrite).toBe(true);
    });

    it('should enforce store security staff access control', async () => {
      const storeId = 'store-123';
      const securityUserId = 'security-user-id';
      
      const aclPolicy: ObjectAclPolicy = {
        owner: 'owner-user-id',
        visibility: 'private',
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

      mockGetMetadata.mockResolvedValue([{
        metadata: {
          'custom:aclPolicy': JSON.stringify(aclPolicy)
        }
      }]);

      // Mock user belonging to the store with security agent access
      storage.getUser.mockResolvedValue({
        id: securityUserId,
        storeId: storeId,
        isActive: true
      });

      storage.getUserAgentsByUser.mockResolvedValue([
        {
          agentId: 'security',
          role: 'operator',
          isActive: true
        }
      ]);

      const canAccess = await canAccessObject({
        userId: securityUserId,
        objectFile: mockFile,
        requestedPermission: ObjectPermission.READ
      });

      expect(canAccess).toBe(true);
      expect(storage.getUser).toHaveBeenCalledWith(securityUserId);
      expect(storage.getUserAgentsByUser).toHaveBeenCalledWith(securityUserId);
    });

    it('should deny access to non-security staff', async () => {
      const storeId = 'store-123';
      const regularUserId = 'regular-user-id';
      
      const aclPolicy: ObjectAclPolicy = {
        owner: 'owner-user-id',
        visibility: 'private',
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

      mockGetMetadata.mockResolvedValue([{
        metadata: {
          'custom:aclPolicy': JSON.stringify(aclPolicy)
        }
      }]);

      // Mock user without security agent access
      storage.getUser.mockResolvedValue({
        id: regularUserId,
        storeId: storeId,
        isActive: true
      });

      storage.getUserAgentsByUser.mockResolvedValue([
        {
          agentId: 'sales',
          role: 'operator',
          isActive: true
        }
      ]);

      const canAccess = await canAccessObject({
        userId: regularUserId,
        objectFile: mockFile,
        requestedPermission: ObjectPermission.READ
      });

      expect(canAccess).toBe(false);
    });

    it('should enforce security agent role-based access', async () => {
      const securityAdminId = 'security-admin-id';
      
      const aclPolicy: ObjectAclPolicy = {
        owner: 'owner-user-id',
        visibility: 'private',
        aclRules: [
          {
            group: {
              type: ObjectAccessGroupType.SECURITY_AGENT_ROLE,
              id: 'admin'
            },
            permission: ObjectPermission.WRITE
          }
        ]
      };

      mockGetMetadata.mockResolvedValue([{
        metadata: {
          'custom:aclPolicy': JSON.stringify(aclPolicy)
        }
      }]);

      storage.getUserAgentsByUser.mockResolvedValue([
        {
          agentId: 'security',
          role: 'admin',
          isActive: true
        }
      ]);

      const canAccess = await canAccessObject({
        userId: securityAdminId,
        objectFile: mockFile,
        requestedPermission: ObjectPermission.WRITE
      });

      expect(canAccess).toBe(true);
    });

    it('should deny access to inactive security agents', async () => {
      const inactiveUserId = 'inactive-user-id';
      
      const aclPolicy: ObjectAclPolicy = {
        owner: 'owner-user-id',
        visibility: 'private',
        aclRules: [
          {
            group: {
              type: ObjectAccessGroupType.SECURITY_AGENT_ROLE,
              id: 'operator'
            },
            permission: ObjectPermission.READ
          }
        ]
      };

      mockGetMetadata.mockResolvedValue([{
        metadata: {
          'custom:aclPolicy': JSON.stringify(aclPolicy)
        }
      }]);

      storage.getUserAgentsByUser.mockResolvedValue([
        {
          agentId: 'security',
          role: 'operator',
          isActive: false // Inactive agent access
        }
      ]);

      const canAccess = await canAccessObject({
        userId: inactiveUserId,
        objectFile: mockFile,
        requestedPermission: ObjectPermission.READ
      });

      expect(canAccess).toBe(false);
    });

    it('should deny access when ACL policy is missing', async () => {
      mockGetMetadata.mockResolvedValue([{
        metadata: {}
      }]);

      const canAccess = await canAccessObject({
        userId: 'any-user-id',
        objectFile: mockFile,
        requestedPermission: ObjectPermission.READ
      });

      expect(canAccess).toBe(false);
    });

    it('should deny access when user ID is not provided for private objects', async () => {
      const aclPolicy: ObjectAclPolicy = {
        owner: 'owner-user-id',
        visibility: 'private',
        aclRules: []
      };

      mockGetMetadata.mockResolvedValue([{
        metadata: {
          'custom:aclPolicy': JSON.stringify(aclPolicy)
        }
      }]);

      const canAccess = await canAccessObject({
        userId: undefined,
        objectFile: mockFile,
        requestedPermission: ObjectPermission.READ
      });

      expect(canAccess).toBe(false);
    });
  });

  describe('Permission Hierarchy', () => {
    it('should allow read access with write permission granted', async () => {
      const userId = 'test-user-id';
      const storeId = 'store-123';
      
      const aclPolicy: ObjectAclPolicy = {
        owner: 'owner-user-id',
        visibility: 'private',
        aclRules: [
          {
            group: {
              type: ObjectAccessGroupType.STORE_SECURITY_STAFF,
              id: storeId
            },
            permission: ObjectPermission.WRITE // Write permission should allow read
          }
        ]
      };

      mockGetMetadata.mockResolvedValue([{
        metadata: {
          'custom:aclPolicy': JSON.stringify(aclPolicy)
        }
      }]);

      storage.getUser.mockResolvedValue({
        id: userId,
        storeId: storeId,
        isActive: true
      });

      storage.getUserAgentsByUser.mockResolvedValue([
        {
          agentId: 'security',
          role: 'operator',
          isActive: true
        }
      ]);

      const canAccess = await canAccessObject({
        userId: userId,
        objectFile: mockFile,
        requestedPermission: ObjectPermission.READ
      });

      expect(canAccess).toBe(true);
    });
  });
});
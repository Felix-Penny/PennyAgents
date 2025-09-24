// Penny MVP Authentication - Based on javascript_auth_all_persistance integration
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { 
  User as DbUser,
  securityRoles,
  rolePermissions,
  userRoleAssignments,
  resourcePermissions,
  permissionAuditLog
} from "@shared/schema";
import { eq, and, or, isNull, gt, inArray } from "drizzle-orm";

declare global {
  namespace Express {
    interface User extends DbUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: false, // Set to false for development
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: 'lax'
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        } else {
          // Update last login
          await storage.updateUser(user.id, { lastLogin: new Date() });
          return done(null, user);
        }
      } catch (error) {
        return done(error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Registration endpoint
  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, email, password, role = "operator", storeId } = req.body;

      // Check if user already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).send("Username already exists");
      }

      if (email) {
        const existingEmail = await storage.getUserByEmail(email);
        if (existingEmail) {
          return res.status(400).send("Email already exists");
        }
      }

      // Create new user with existing database structure
      const user = await storage.createUser({
        username,
        email,
        password: await hashPassword(password),
        role,
        storeId,
        isActive: true,
      });

      req.login(user, (err) => {
        if (err) return next(err);
        // Return sanitized user object without password
        const { password: _, ...safeUser } = user;
        res.status(201).json(safeUser);
      });
    } catch (error) {
      next(error);
    }
  });

  // Login endpoint
  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ message: "Authentication error", error: err.message });
      }
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      req.login(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ message: "Login error", error: loginErr.message });
        }
        // Return sanitized user object without password
        const { password: _, ...safeUser } = user;
        res.status(200).json(safeUser);
      });
    })(req, res, next);
  });

  // Logout endpoint
  app.post("/api/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  // Get current user
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    // Return sanitized user object without password
    const { password: _, ...safeUser } = req.user as any;
    res.json(safeUser);
  });
}

// =====================================
// Role-based Access Control Middleware
// =====================================

export function requireAuth(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

export function requireRole(allowedRoles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: "Insufficient permissions" });
    }

    next();
  };
}

// Specific role middleware for Penny MVP
export const requireStoreStaff = requireRole(["store_staff", "store_admin", "penny_admin"]);
export const requireStoreAdmin = requireRole(["store_admin", "penny_admin"]);
export const requirePennyAdmin = requireRole(["penny_admin"]);
export const requireOffender = requireRole(["offender"]);

// Store-specific access control
export function requireStoreAccess(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const user = req.user;
  const requestedStoreId = req.params.storeId || req.body.storeId || req.query.storeId;

  // Penny admins can access any store
  if (user.role === "penny_admin") {
    return next();
  }

  // Store staff can only access their own store
  if (user.storeId && user.storeId !== requestedStoreId) {
    return res.status(403).json({ message: "Access denied to this store" });
  }

  next();
}

// Offender-specific access control (for Offender Portal)
export async function requireOffenderAccess(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const user = req.user;
  const requestedOffenderId = req.params.offenderId || req.body.offenderId;

  // Penny admins can access any offender data
  if (user.role === "penny_admin") {
    return next();
  }

  // For offenders, check via offenders.linked_user_id
  if (user.role === "offender") {
    try {
      const offender = await storage.getOffender(requestedOffenderId);
      if (!offender || offender.linkedUserId !== user.id) {
        return res.status(403).json({ message: "Access denied to this offender data" });
      }
    } catch (error) {
      return res.status(500).json({ message: "Error checking offender access" });
    }
  }

  next();
}

// =====================================
// Multi-Agent Platform Access Control
// =====================================

// Platform role-based access control
export function requirePlatformRole(allowedPlatformRoles: string[]) {
  return (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = req.user;
    
    // Super admins can access everything
    if (user.platformRole === "super_admin") {
      return next();
    }

    if (!user.platformRole || !allowedPlatformRoles.includes(user.platformRole)) {
      return res.status(403).json({ message: "Insufficient platform permissions" });
    }

    next();
  };
}

// Agent-specific access control
export function requireAgentAccess(agentId: string, minimumRole?: string) {
  return async (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = req.user;

    // Super admins can access any agent
    if (user.platformRole === "super_admin") {
      return next();
    }
    
    // Org admins can only access agents within their organization
    if (user.platformRole === "org_admin") {
      // This will be handled by the user agent access check below
      // Don't bypass - let it check the user_agent_access table
    }

    try {
      // Check user's agent access
      const agentAccess = await storage.getUserAgentAccess(user.id, agentId);

      if (!agentAccess || !agentAccess.isActive) {
        return res.status(403).json({ message: "Access denied to this agent" });
      }

      // Check minimum role requirement if specified
      if (minimumRole) {
        const roleHierarchy = ["viewer", "operator", "admin"];
        const userRoleLevel = roleHierarchy.indexOf(agentAccess.role);
        const requiredRoleLevel = roleHierarchy.indexOf(minimumRole);

        if (userRoleLevel < requiredRoleLevel) {
          return res.status(403).json({ message: "Insufficient agent permissions" });
        }
      }

      // Add agent access info to request for downstream use
      req.userAgentAccess = agentAccess;
      next();
    } catch (error) {
      return res.status(500).json({ message: "Error checking agent access" });
    }
  };
}

// Organization boundary access control
export function requireOrganizationAccess(req: any, res: any, next: any) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Authentication required" });
  }

  const user = req.user;
  const requestedOrgId = req.params.orgId || req.params.organizationId || req.body.organizationId;

  // Super admins can access any organization
  if (user.platformRole === "super_admin") {
    return next();
  }

  // Users must have an organization assigned
  if (!user.organizationId) {
    return res.status(403).json({ message: "Access denied to this organization" });
  }

  // If a specific organization is requested, check that the user belongs to it
  if (requestedOrgId && user.organizationId !== requestedOrgId) {
    return res.status(403).json({ message: "Access denied to this organization" });
  }

  next();
}

// Combined agent and organization access control
export function requireAgentWithOrganization(agentId: string, minimumRole?: string) {
  return async (req: any, res: any, next: any) => {
    // First check organization access
    requireOrganizationAccess(req, res, async (orgErr: any) => {
      if (orgErr) return next(orgErr);
      
      // Then check agent access
      const agentMiddleware = requireAgentAccess(agentId, minimumRole);
      return agentMiddleware(req, res, next);
    });
  };
}

// Convenience middleware for specific agents
export const requireSecurityAgent = (minimumRole?: string) => requireAgentAccess("security-agent", minimumRole);
export const requireCyberSecurityAgent = (minimumRole?: string) => requireAgentAccess("cyber-security-agent", minimumRole);
export const requireFinanceAgent = (minimumRole?: string) => requireAgentAccess("finance", minimumRole);
export const requireSalesAgent = (minimumRole?: string) => requireAgentAccess("sales", minimumRole);
export const requireOperationsAgent = (minimumRole?: string) => requireAgentAccess("operations", minimumRole);
export const requireHRAgent = (minimumRole?: string) => requireAgentAccess("hr", minimumRole);

// Platform admin roles
export const requireSuperAdmin = requirePlatformRole(["super_admin"]);
export const requireOrgAdmin = requirePlatformRole(["org_admin", "super_admin"]);
export const requirePlatformUser = requirePlatformRole(["user", "org_admin", "super_admin"]);

// =====================================
// Enhanced Role-Based Access Control (RBAC) System
// =====================================

// Types for enhanced RBAC system
interface UserPermissions {
  cameras: { view: boolean; control: boolean; configure: boolean; history: boolean };
  alerts: { receive: boolean; acknowledge: boolean; dismiss: boolean; escalate: boolean; manage: boolean; configure: boolean };
  incidents: { create: boolean; investigate: boolean; assign: boolean; resolve: boolean; close: boolean };
  evidence: { upload: boolean; view: boolean; download: boolean; manage: boolean; audit: boolean };
  analytics: { executive: boolean; operational: boolean; safety: boolean; public: boolean; reports: boolean; export: boolean };
  users: { view: boolean; create: boolean; edit: boolean; delete: boolean; assign_roles: boolean };
  system: { configure: boolean; audit: boolean; backup: boolean; maintenance: boolean };
}

export interface PermissionContext {
  userId: string;
  roleIds?: string[];
  storeId?: string;
  organizationId?: string;
  resourceType?: string;
  resourceId?: string;
  action: string;
  timestamp?: Date;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
}

interface PermissionCheckResult {
  granted: boolean;
  reason?: string;
  restrictedBy?: string[];
  auditRequired?: boolean;
  requiresApproval?: boolean;
  requiresWitness?: boolean;
  conditions?: any;
}

type SecurityRole = typeof securityRoles.$inferSelect;
type InsertPermissionAuditLog = typeof permissionAuditLog.$inferInsert;

// Permission checking engine
export class PermissionEngine {
  private static instance: PermissionEngine;
  
  static getInstance(): PermissionEngine {
    if (!PermissionEngine.instance) {
      PermissionEngine.instance = new PermissionEngine();
    }
    return PermissionEngine.instance;
  }

  // Check if user has specific permission
  async checkPermission(context: PermissionContext): Promise<PermissionCheckResult> {
    const startTime = Date.now();
    
    try {
      // Get user's security roles and permissions
      const userRoles = await this.getUserSecurityRoles(context.userId);
      const permissions = await this.aggregateUserPermissions(userRoles, context.storeId, context.organizationId);
      
      // Check permission based on action and resource
      const hasPermission = this.evaluatePermission(permissions, context.action, context.resourceType);
      
      // Additional checks for resource-specific permissions
      const resourcePermission = context.resourceId ? 
        await this.checkResourcePermission(context) : { granted: true, reason: "No specific resource check needed" };
      
      const finalDecision = hasPermission && resourcePermission.granted;
      const reason = finalDecision ? 
        "Permission granted" : 
        (hasPermission ? resourcePermission.reason : "Insufficient role permissions");
      
      // Log the permission check
      await this.auditPermissionCheck(context, {
        granted: finalDecision,
        reason,
        restrictedBy: finalDecision ? undefined : [`role_permissions`],
        auditRequired: true,
        processingTimeMs: Date.now() - startTime
      });
      
      return {
        granted: finalDecision,
        reason,
        restrictedBy: finalDecision ? undefined : [`role_permissions`],
        auditRequired: true,
        requiresApproval: this.requiresApproval(context.action, permissions),
        requiresWitness: this.requiresWitness(context.action, permissions),
        conditions: {}
      };
      
    } catch (error) {
      // Log error and deny access
      await this.auditPermissionCheck(context, {
        granted: false,
        reason: `Permission check failed: ${error.message}`,
        restrictedBy: ['system_error'],
        auditRequired: true,
        processingTimeMs: Date.now() - startTime
      });
      
      return {
        granted: false,
        reason: `Permission check failed: ${error.message}`,
        restrictedBy: ['system_error'],
        auditRequired: true
      };
    }
  }

  // Get user's security roles with inheritance
  private async getUserSecurityRoles(userId: string): Promise<SecurityRole[]> {
    try {
      // For now, return a basic role until we implement the storage methods
      // This will be enhanced when storage.ts is updated with RBAC methods
      return [];
    } catch (error) {
      console.error('Error getting user security roles:', error);
      return [];
    }
  }

  // Get inherited roles based on role hierarchy
  private async getInheritedRoles(userRoles: SecurityRole[]): Promise<SecurityRole[]> {
    // Simplified for now - will be enhanced when storage methods are implemented
    return [];
  }

  // Aggregate permissions from all user roles
  private async aggregateUserPermissions(
    roles: SecurityRole[], 
    storeId?: string, 
    organizationId?: string
  ): Promise<UserPermissions> {
    const aggregatedPermissions: UserPermissions = {
      cameras: { view: false, control: false, configure: false, history: false },
      alerts: { receive: false, acknowledge: false, dismiss: false, escalate: false, manage: false, configure: false },
      incidents: { create: false, investigate: false, assign: false, resolve: false, close: false },
      evidence: { upload: false, view: false, download: false, manage: false, audit: false },
      analytics: { executive: false, operational: false, safety: false, public: false, reports: false, export: false },
      users: { view: false, create: false, edit: false, delete: false, assign_roles: false },
      system: { configure: false, audit: false, backup: false, maintenance: false },
      // Add the missing security permissions structure
      security: {
        behavior: { read: false, write: false, analyze: false },
        face: { manage: false, search: false, template_access: false, match: false },
        privacy: { manage: false, consent_check: false, consent_grant: false, consent_withdraw: false },
        predict: { read: false, generate: false, model_access: false },
        audit: { read: false, export: false, manage: false },
        watchlist: { view: false, add: false, remove: false, manage: false },
        biometric: { encrypt: false, decrypt: false, access: false, manage: false },
        advanced: { anomaly_detect: false, baseline_profile: false, risk_score: false }
      }
    };

    // Apply permissions from each role (OR logic - if any role grants permission, user has it)
    for (const role of roles) {
      const rolePermissions = await this.getRolePermissions(role.id, storeId, organizationId);
      this.mergePermissions(aggregatedPermissions, rolePermissions);
    }

    return aggregatedPermissions;
  }

  // Get permissions for a specific role
  private async getRolePermissions(
    roleId: string, 
    storeId?: string, 
    organizationId?: string
  ): Promise<UserPermissions> {
    // For now, return default permissions - will be enhanced when storage methods are implemented
    return {
      cameras: { view: false, control: false, configure: false, history: false },
      alerts: { receive: false, acknowledge: false, dismiss: false, escalate: false, manage: false, configure: false },
      incidents: { create: false, investigate: false, assign: false, resolve: false, close: false },
      evidence: { upload: false, view: false, download: false, manage: false, audit: false },
      analytics: { executive: false, operational: false, safety: false, public: false, reports: false, export: false },
      users: { view: false, create: false, edit: false, delete: false, assign_roles: false },
      system: { configure: false, audit: false, backup: false, maintenance: false },
      security: {
        behavior: { read: false, write: false, analyze: false },
        face: { manage: false, search: false, template_access: false, match: false },
        privacy: { manage: false, consent_check: false, consent_grant: false, consent_withdraw: false },
        predict: { read: false, generate: false, model_access: false },
        audit: { read: false, export: false, manage: false },
        watchlist: { view: false, add: false, remove: false, manage: false },
        biometric: { encrypt: false, decrypt: false, access: false, manage: false },
        advanced: { anomaly_detect: false, baseline_profile: false, risk_score: false }
      }
    };
  }

  // Merge permissions using OR logic
  private mergePermissions(target: UserPermissions, source: UserPermissions): void {
    Object.keys(target).forEach(resource => {
      Object.keys(target[resource]).forEach(action => {
        target[resource][action] = target[resource][action] || source[resource][action];
      });
    });
  }

  // Evaluate if user has specific permission with proper multi-level path traversal
  private evaluatePermission(permissions: UserPermissions, action: string, resourceType?: string): boolean {
    // Handle multi-level permission paths like "security:behavior:read"
    const permissionParts = action.split(':');
    let currentLevel: any = permissions;
    
    // Traverse the permission path step by step
    for (const part of permissionParts) {
      if (!currentLevel || typeof currentLevel !== 'object' || !currentLevel.hasOwnProperty(part)) {
        console.warn(`Permission path traversal failed at '${part}' for action '${action}'`);
        return false;
      }
      currentLevel = currentLevel[part];
    }
    
    // Final value should be a boolean true to grant permission
    if (currentLevel !== true && currentLevel !== false) {
      console.warn(`Permission path '${action}' does not resolve to a boolean value:`, currentLevel);
      return false;
    }
    
    return currentLevel === true;
  }

  // Check resource-specific permissions
  private async checkResourcePermission(context: PermissionContext): Promise<PermissionCheckResult> {
    // For now, return granted for non-sensitive resources - will be enhanced when storage methods are implemented
    return {
      granted: true,
      reason: "Resource permission check placeholder",
      auditRequired: true
    };
  }

  // Check if action requires approval
  private requiresApproval(action: string, permissions: UserPermissions): boolean {
    const highRiskActions = ['system:configure', 'users:delete', 'evidence:manage', 'incidents:close'];
    return highRiskActions.includes(action);
  }

  // Check if action requires witness
  private requiresWitness(action: string, permissions: UserPermissions): boolean {
    const witnessRequiredActions = ['evidence:download', 'system:backup', 'users:assign_roles'];
    return witnessRequiredActions.includes(action);
  }

  // Audit permission check
  private async auditPermissionCheck(
    context: PermissionContext, 
    result: Partial<PermissionCheckResult> & { processingTimeMs?: number }
  ): Promise<void> {
    try {
      // Log to console for now - will be enhanced to use database when storage methods are implemented
      console.log('Permission Check Audit:', {
        userId: context.userId,
        action: context.action,
        granted: result.granted,
        reason: result.reason,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to audit permission check:', error);
      // Don't throw - auditing failure shouldn't break permission checking
    }
  }
}

// Enhanced permission middleware factory
export function requirePermission(permission: string, resourceType?: string) {
  return async (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = req.user;
    const engine = PermissionEngine.getInstance();
    
    const context: PermissionContext = {
      userId: user.id,
      roleIds: [], // Will be populated by the engine
      storeId: req.params.storeId || req.body.storeId || user.storeId,
      organizationId: user.organizationId,
      resourceType,
      resourceId: req.params.id || req.params.resourceId,
      action: permission,
      timestamp: new Date(),
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      sessionId: req.sessionID
    };

    try {
      const result = await engine.checkPermission(context);
      
      if (!result.granted) {
        return res.status(403).json({ 
          message: "Insufficient permissions",
          reason: result.reason,
          requiredPermission: permission
        });
      }

      // Add permission context to request for downstream use
      req.permissionContext = context;
      req.permissionResult = result;
      
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ message: "Permission check failed" });
    }
  };
}

// Enhanced security role-based middleware
export function requireSecurityRole(allowedRoles: string[]) {
  return async (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const user = req.user;
    const engine = PermissionEngine.getInstance();
    
    try {
      const userRoles = await engine.getUserSecurityRoles(user.id);
      const hasRequiredRole = userRoles.some(role => allowedRoles.includes(role.name));
      
      if (!hasRequiredRole) {
        // Audit the failed role check
        await engine.auditPermissionCheck({
          userId: user.id,
          roleIds: userRoles.map(r => r.id),
          action: 'role_check',
          timestamp: new Date(),
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          sessionId: req.sessionID
        }, {
          granted: false,
          reason: `Required roles: ${allowedRoles.join(', ')}. User roles: ${userRoles.map(r => r.name).join(', ')}`
        });
        
        return res.status(403).json({ 
          message: "Insufficient role permissions",
          requiredRoles: allowedRoles,
          userRoles: userRoles.map(r => r.name)
        });
      }

      // Add role context to request
      req.securityRoles = userRoles;
      req.hasSecurityRole = (roleName: string) => userRoles.some(r => r.name === roleName);
      
      next();
    } catch (error) {
      console.error('Security role check error:', error);
      return res.status(500).json({ message: "Role check failed" });
    }
  };
}

// Convenience middleware for specific security roles
export const requireSecurityManager = requireSecurityRole(['admin']);
export const requireSecurityPersonnel = requireSecurityRole(['admin', 'security_personnel']);
export const requireSafetyCoordinator = requireSecurityRole(['admin', 'security_personnel', 'safety_coordinator']);
export const requireSecurityAccess = requireSecurityRole(['admin', 'security_personnel', 'safety_coordinator', 'guest']);

// Enhanced RBAC permissions interface with advanced AI features
interface UserPermissions {
  cameras: { view: boolean; control: boolean; configure: boolean; history: boolean };
  alerts: { receive: boolean; acknowledge: boolean; dismiss: boolean; escalate: boolean; manage: boolean; configure: boolean };
  incidents: { create: boolean; investigate: boolean; assign: boolean; resolve: boolean; close: boolean };
  evidence: { upload: boolean; view: boolean; download: boolean; manage: boolean; audit: boolean };
  analytics: { executive: boolean; operational: boolean; safety: boolean; public: boolean; reports: boolean; export: boolean };
  users: { view: boolean; create: boolean; edit: boolean; delete: boolean; assign_roles: boolean };
  system: { configure: boolean; audit: boolean; backup: boolean; maintenance: boolean };
  // Advanced AI Features - Privacy-Compliant Permissions
  security: {
    behavior: { read: boolean; write: boolean; analyze: boolean };
    face: { manage: boolean; search: boolean; template_access: boolean; match: boolean };
    privacy: { manage: boolean; consent_check: boolean; consent_grant: boolean; consent_withdraw: boolean };
    predict: { read: boolean; generate: boolean; model_access: boolean };
    audit: { read: boolean; export: boolean; manage: boolean };
    watchlist: { view: boolean; add: boolean; remove: boolean; manage: boolean };
    biometric: { encrypt: boolean; decrypt: boolean; access: boolean; manage: boolean };
    advanced: { anomaly_detect: boolean; baseline_profile: boolean; risk_score: boolean };
  };
}

// Fallback permissions based on legacy role system
export function getDefaultPermissions(userRole?: string): UserPermissions {
  const basePermissions: UserPermissions = {
    cameras: { view: false, control: false, configure: false, history: false },
    alerts: { receive: false, acknowledge: false, dismiss: false, escalate: false, manage: false, configure: false },
    incidents: { create: false, investigate: false, assign: false, resolve: false, close: false },
    evidence: { upload: false, view: false, download: false, manage: false, audit: false },
    analytics: { executive: false, operational: false, safety: false, public: true, reports: false, export: false },
    users: { view: false, create: false, edit: false, delete: false, assign_roles: false },
    system: { configure: false, audit: false, backup: false, maintenance: false },
    // Advanced AI Features - Default to false for privacy protection
    security: {
      behavior: { read: false, write: false, analyze: false },
      face: { manage: false, search: false, template_access: false, match: false },
      privacy: { manage: false, consent_check: true, consent_grant: false, consent_withdraw: true }, // Allow consent checks/withdrawal by default
      predict: { read: false, generate: false, model_access: false },
      audit: { read: false, export: false, manage: false },
      watchlist: { view: false, add: false, remove: false, manage: false },
      biometric: { encrypt: false, decrypt: false, access: false, manage: false },
      advanced: { anomaly_detect: false, baseline_profile: false, risk_score: false }
    }
  };

  // Map legacy roles to security permissions with advanced AI features
  switch (userRole) {
    case 'penny_admin':
      return {
        cameras: { view: true, control: true, configure: true, history: true },
        alerts: { receive: true, acknowledge: true, dismiss: true, escalate: true, manage: true, configure: true },
        incidents: { create: true, investigate: true, assign: true, resolve: true, close: true },
        evidence: { upload: true, view: true, download: true, manage: true, audit: true },
        analytics: { executive: true, operational: true, safety: true, public: true, reports: true, export: true },
        users: { view: true, create: true, edit: true, delete: true, assign_roles: true },
        system: { configure: true, audit: true, backup: true, maintenance: true },
        // Full access to advanced AI features for penny_admin
        security: {
          behavior: { read: true, write: true, analyze: true },
          face: { manage: true, search: true, template_access: true, match: true },
          privacy: { manage: true, consent_check: true, consent_grant: true, consent_withdraw: true },
          predict: { read: true, generate: true, model_access: true },
          audit: { read: true, export: true, manage: true },
          watchlist: { view: true, add: true, remove: true, manage: true },
          biometric: { encrypt: true, decrypt: true, access: true, manage: true },
          advanced: { anomaly_detect: true, baseline_profile: true, risk_score: true }
        }
      };
    
    case 'store_admin':
      return {
        cameras: { view: true, control: true, configure: false, history: true },
        alerts: { receive: true, acknowledge: true, dismiss: true, escalate: true, manage: false, configure: false },
        incidents: { create: true, investigate: true, assign: true, resolve: true, close: false },
        evidence: { upload: true, view: true, download: true, manage: false, audit: false },
        analytics: { executive: false, operational: true, safety: true, public: true, reports: true, export: false },
        users: { view: true, create: false, edit: false, delete: false, assign_roles: false },
        system: { configure: false, audit: true, backup: false, maintenance: false },
        // Limited access to advanced AI features for store_admin
        security: {
          behavior: { read: true, write: false, analyze: true },
          face: { manage: false, search: true, template_access: false, match: true },
          privacy: { manage: false, consent_check: true, consent_grant: false, consent_withdraw: true },
          predict: { read: true, generate: false, model_access: false },
          audit: { read: true, export: false, manage: false },
          watchlist: { view: true, add: false, remove: false, manage: false },
          biometric: { encrypt: false, decrypt: false, access: false, manage: false },
          advanced: { anomaly_detect: true, baseline_profile: false, risk_score: true }
        }
      };
    
    case 'store_staff':
      return {
        cameras: { view: true, control: false, configure: false, history: false },
        alerts: { receive: true, acknowledge: true, dismiss: false, escalate: true, manage: false, configure: false },
        incidents: { create: true, investigate: false, assign: false, resolve: false, close: false },
        evidence: { upload: false, view: true, download: false, manage: false, audit: false },
        analytics: { executive: false, operational: false, safety: true, public: true, reports: false, export: false },
        users: { view: true, edit: false, delete: false, create: false, assign_roles: false },
        system: { configure: false, audit: false, backup: false, maintenance: false },
        // Very limited access to advanced AI features for store_staff
        security: {
          behavior: { read: true, write: false, analyze: false },
          face: { manage: false, search: false, template_access: false, match: false },
          privacy: { manage: false, consent_check: true, consent_grant: false, consent_withdraw: true },
          predict: { read: false, generate: false, model_access: false },
          audit: { read: false, export: false, manage: false },
          watchlist: { view: false, add: false, remove: false, manage: false },
          biometric: { encrypt: false, decrypt: false, access: false, manage: false },
          advanced: { anomaly_detect: false, baseline_profile: false, risk_score: false }
        }
      };

    default:
      return basePermissions;
  }
}

// Fallback security roles based on legacy role system
export function getDefaultSecurityRoles(userRole?: string): SecurityRole[] {
  const roles: SecurityRole[] = [];

  switch (userRole) {
    case 'penny_admin':
      roles.push({
        id: 'admin',
        name: 'admin',
        displayName: 'Security Manager',
        description: 'Full administrative access to all security systems',
        category: 'security',
        level: 1,
        clearanceLevel: 'classified',
        scope: 'global',
        isActive: true
      });
      break;
    
    case 'store_admin':
      roles.push({
        id: 'security_personnel',
        name: 'security_personnel',
        displayName: 'Guard/Officer',
        description: 'Operational access for field security work',
        category: 'security',
        level: 2,
        clearanceLevel: 'elevated',
        scope: 'store',
        isActive: true
      });
      break;
    
    case 'store_staff':
      roles.push({
        id: 'safety_coordinator',
        name: 'safety_coordinator', 
        displayName: 'Safety Coordinator',
        description: 'Safety-focused access with compliance responsibilities',
        category: 'safety',
        level: 3,
        clearanceLevel: 'basic',
        scope: 'store',
        isActive: true
      });
      break;

    default:
      roles.push({
        id: 'guest',
        name: 'guest',
        displayName: 'Visitor',
        description: 'Limited public access',
        category: 'public',
        level: 4,
        clearanceLevel: 'public',
        scope: 'limited',
        isActive: true
      });
      break;
  }

  return roles;
}

// Resource-specific permission middleware
export const requireCameraAccess = (action: string) => requirePermission(`cameras:${action}`, 'camera');
export const requireAlertAccess = (action: string) => requirePermission(`alerts:${action}`, 'alert');
export const requireIncidentAccess = (action: string) => requirePermission(`incidents:${action}`, 'incident');
export const requireEvidenceAccess = (action: string) => requirePermission(`evidence:${action}`, 'evidence');
export const requireAnalyticsAccess = (action: string) => requirePermission(`analytics:${action}`, 'analytics');
export const requireUserManagement = (action: string) => requirePermission(`users:${action}`, 'user');
export const requireSystemAccess = (action: string) => requirePermission(`system:${action}`, 'system');
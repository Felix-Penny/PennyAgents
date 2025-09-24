// Penny MVP Authentication - Based on javascript_auth_all_persistance integration
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as DbUser } from "@shared/schema";

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
export const requireSecurityAgent = (minimumRole?: string) => requireAgentAccess("security", minimumRole);
export const requireFinanceAgent = (minimumRole?: string) => requireAgentAccess("finance", minimumRole);
export const requireSalesAgent = (minimumRole?: string) => requireAgentAccess("sales", minimumRole);
export const requireOperationsAgent = (minimumRole?: string) => requireAgentAccess("operations", minimumRole);
export const requireHRAgent = (minimumRole?: string) => requireAgentAccess("hr", minimumRole);

// Platform admin roles
export const requireSuperAdmin = requirePlatformRole(["super_admin"]);
export const requireOrgAdmin = requirePlatformRole(["org_admin", "super_admin"]);
export const requirePlatformUser = requirePlatformRole(["user", "org_admin", "super_admin"]);
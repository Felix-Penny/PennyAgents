// Enhanced Role-Based Access Control Hook
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { createContext, useContext, ReactNode } from "react";

// Permission types matching backend implementation
interface UserPermissions {
  cameras: { view: boolean; control: boolean; configure: boolean; history: boolean };
  alerts: { receive: boolean; acknowledge: boolean; dismiss: boolean; escalate: boolean; manage: boolean; configure: boolean };
  incidents: { create: boolean; investigate: boolean; assign: boolean; resolve: boolean; close: boolean };
  evidence: { upload: boolean; view: boolean; download: boolean; manage: boolean; audit: boolean };
  analytics: { executive: boolean; operational: boolean; safety: boolean; public: boolean; reports: boolean; export: boolean };
  users: { view: boolean; create: boolean; edit: boolean; delete: boolean; assign_roles: boolean };
  system: { configure: boolean; audit: boolean; backup: boolean; maintenance: boolean };
}

interface PermissionContext {
  userId?: string;
  storeId?: string;
  organizationId?: string;
  resourceType?: string;
  resourceId?: string;
  action: string;
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

interface SecurityRole {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  category: string;
  level: number;
  clearanceLevel: string;
  scope: string;
  isActive: boolean;
}

interface PermissionsContextType {
  permissions: UserPermissions | null;
  securityRoles: SecurityRole[];
  isLoading: boolean;
  error: Error | null;
  hasPermission: (permission: string, resourceType?: string, resourceId?: string) => boolean;
  checkPermission: (context: PermissionContext) => Promise<PermissionCheckResult>;
  hasSecurityRole: (roleName: string) => boolean;
  getHighestSecurityRole: () => SecurityRole | null;
  refetch: () => void;
}

const PermissionsContext = createContext<PermissionsContextType | null>(null);

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  // Fetch user permissions
  const {
    data: permissionsData,
    error: permissionsError,
    isLoading: permissionsLoading,
    refetch: refetchPermissions
  } = useQuery<{ permissions: UserPermissions; roles: SecurityRole[] }>({
    queryKey: ["/api/user/permissions"],
    enabled: !!user,
    queryFn: async () => {
      const response = await fetch("/api/user/permissions", { 
        credentials: "include",
        headers: {
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) {
        if (response.status === 404) {
          // Fallback to default permissions if endpoint doesn't exist yet
          return {
            permissions: getDefaultPermissions(user?.role || undefined),
            roles: getDefaultSecurityRoles(user?.role || undefined)
          };
        }
        throw new Error(`Failed to fetch permissions: ${response.status}`);
      }
      return response.json();
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });

  // Check if user has specific permission
  const hasPermission = (permission: string, resourceType?: string, resourceId?: string): boolean => {
    if (!permissionsData?.permissions) return false;

    const [resource, action] = permission.includes(':') ? permission.split(':') : [resourceType, permission];
    
    if (!resource || !action) return false;
    
    const resourcePermissions = permissionsData.permissions[resource as keyof UserPermissions];
    if (!resourcePermissions || typeof resourcePermissions !== 'object') return false;
    
    return Boolean(resourcePermissions[action as keyof typeof resourcePermissions]);
  };

  // Check permission with full context (for advanced scenarios)
  const checkPermission = async (context: PermissionContext): Promise<PermissionCheckResult> => {
    try {
      const response = await fetch("/api/permissions/check", {
        method: "POST",
        credentials: "include",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(context)
      });

      if (!response.ok) {
        // Fallback to local permission check if endpoint doesn't exist
        return {
          granted: hasPermission(context.action, context.resourceType, context.resourceId),
          reason: "Local permission check (endpoint not available)",
          auditRequired: false
        };
      }

      return response.json();
    } catch (error) {
      // Fallback to local permission check on error
      return {
        granted: hasPermission(context.action, context.resourceType, context.resourceId),
        reason: `Permission check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        auditRequired: false
      };
    }
  };

  // Check if user has specific security role
  const hasSecurityRole = (roleName: string): boolean => {
    if (!permissionsData?.roles) return false;
    return permissionsData.roles.some(role => role.name === roleName && role.isActive);
  };

  // Get the highest security role (lowest level number)
  const getHighestSecurityRole = (): SecurityRole | null => {
    if (!permissionsData?.roles || permissionsData.roles.length === 0) return null;
    
    return permissionsData.roles
      .filter(role => role.isActive)
      .sort((a, b) => a.level - b.level)[0] || null;
  };

  const contextValue: PermissionsContextType = {
    permissions: permissionsData?.permissions || null,
    securityRoles: permissionsData?.roles || [],
    isLoading: permissionsLoading,
    error: permissionsError,
    hasPermission,
    checkPermission,
    hasSecurityRole,
    getHighestSecurityRole,
    refetch: refetchPermissions
  };

  return (
    <PermissionsContext.Provider value={contextValue}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error("usePermissions must be used within a PermissionsProvider");
  }
  return context;
}

// Fallback permissions based on legacy role system
function getDefaultPermissions(userRole?: string): UserPermissions {
  const basePermissions: UserPermissions = {
    cameras: { view: false, control: false, configure: false, history: false },
    alerts: { receive: false, acknowledge: false, dismiss: false, escalate: false, manage: false, configure: false },
    incidents: { create: false, investigate: false, assign: false, resolve: false, close: false },
    evidence: { upload: false, view: false, download: false, manage: false, audit: false },
    analytics: { executive: false, operational: false, safety: false, public: true, reports: false, export: false },
    users: { view: false, create: false, edit: false, delete: false, assign_roles: false },
    system: { configure: false, audit: false, backup: false, maintenance: false }
  };

  // Map legacy roles to security permissions
  switch (userRole) {
    case 'penny_admin':
      return {
        cameras: { view: true, control: true, configure: true, history: true },
        alerts: { receive: true, acknowledge: true, dismiss: true, escalate: true, manage: true, configure: true },
        incidents: { create: true, investigate: true, assign: true, resolve: true, close: true },
        evidence: { upload: true, view: true, download: true, manage: true, audit: true },
        analytics: { executive: true, operational: true, safety: true, public: true, reports: true, export: true },
        users: { view: true, create: true, edit: true, delete: true, assign_roles: true },
        system: { configure: true, audit: true, backup: true, maintenance: true }
      };
    
    case 'store_admin':
      return {
        cameras: { view: true, control: true, configure: false, history: true },
        alerts: { receive: true, acknowledge: true, dismiss: true, escalate: true, manage: false, configure: false },
        incidents: { create: true, investigate: true, assign: true, resolve: true, close: false },
        evidence: { upload: true, view: true, download: true, manage: false, audit: false },
        analytics: { executive: false, operational: true, safety: true, public: true, reports: true, export: false },
        users: { view: true, create: false, edit: false, delete: false, assign_roles: false },
        system: { configure: false, audit: true, backup: false, maintenance: false }
      };
    
    case 'store_staff':
      return {
        cameras: { view: true, control: false, configure: false, history: false },
        alerts: { receive: true, acknowledge: true, dismiss: false, escalate: true, manage: false, configure: false },
        incidents: { create: true, investigate: false, assign: false, resolve: false, close: false },
        evidence: { upload: false, view: true, download: false, manage: false, audit: false },
        analytics: { executive: false, operational: false, safety: true, public: true, reports: false, export: false },
        users: { view: true, edit: false, delete: false, create: false, assign_roles: false },
        system: { configure: false, audit: false, backup: false, maintenance: false }
      };

    default:
      return basePermissions;
  }
}

// Fallback security roles based on legacy role system
function getDefaultSecurityRoles(userRole?: string): SecurityRole[] {
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
        description: 'Limited read-only access to public safety information',
        category: 'visitor',
        level: 4,
        clearanceLevel: 'basic',
        scope: 'store',
        isActive: true
      });
      break;
  }

  return roles;
}

// Enhanced role checking helpers
export function useSecurityRole() {
  const { hasSecurityRole, getHighestSecurityRole, securityRoles } = usePermissions();
  
  return {
    isSecurityManager: () => hasSecurityRole('admin'),
    isGuardOfficer: () => hasSecurityRole('security_personnel'),
    isSafetyCoordinator: () => hasSecurityRole('safety_coordinator'),
    isVisitor: () => hasSecurityRole('guest'),
    hasSecurityAccess: () => hasSecurityRole('admin') || hasSecurityRole('security_personnel') || hasSecurityRole('safety_coordinator'),
    getHighestRole: getHighestSecurityRole,
    getAllRoles: () => securityRoles
  };
}
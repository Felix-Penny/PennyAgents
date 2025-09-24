// Permission Gate Component for Conditional Rendering
import { ReactNode } from "react";
import { usePermissions, useSecurityRole } from "@/hooks/use-permissions";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, ShieldAlert, Lock } from "lucide-react";

interface PermissionGateProps {
  children: ReactNode;
  // Permission-based access
  permission?: string;
  resourceType?: string;
  resourceId?: string;
  // Role-based access
  allowedRoles?: string[];
  securityRoles?: string[];
  // Multiple permission modes
  permissions?: string[];
  requireAll?: boolean; // true = AND logic, false = OR logic (default)
  // Fallback content
  fallback?: ReactNode;
  loadingFallback?: ReactNode;
  // Visual settings
  showAccessDenied?: boolean;
  logAccess?: boolean;
}

export function PermissionGate({
  children,
  permission,
  resourceType,
  resourceId,
  allowedRoles,
  securityRoles,
  permissions,
  requireAll = false,
  fallback,
  loadingFallback,
  showAccessDenied = false,
  logAccess = false
}: PermissionGateProps) {
  const { user } = useAuth();
  const { hasPermission, isLoading, hasSecurityRole } = usePermissions();
  const securityRoleHelpers = useSecurityRole();

  // Loading state
  if (isLoading || !user) {
    if (loadingFallback) {
      return <>{loadingFallback}</>;
    }
    return (
      <div className="flex items-center justify-center p-2" data-testid="permission-gate-loading">
        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
      </div>
    );
  }

  let hasAccess = false;
  let denialReason = "Access denied";

  // Check legacy role-based access first (backwards compatibility)
  if (allowedRoles && user.role) {
    hasAccess = allowedRoles.includes(user.role);
    if (!hasAccess) {
      denialReason = `Required roles: ${allowedRoles.join(', ')}. Current role: ${user.role}`;
    }
  }

  // Check security role-based access
  if (!hasAccess && securityRoles) {
    hasAccess = securityRoles.some(role => hasSecurityRole(role));
    if (!hasAccess) {
      denialReason = `Required security roles: ${securityRoles.join(', ')}`;
    }
  }

  // Check single permission
  if (!hasAccess && permission) {
    hasAccess = hasPermission(permission, resourceType, resourceId);
    if (!hasAccess) {
      denialReason = `Missing permission: ${permission}`;
    }
  }

  // Check multiple permissions
  if (!hasAccess && permissions && permissions.length > 0) {
    if (requireAll) {
      // AND logic - user must have ALL permissions
      hasAccess = permissions.every(perm => hasPermission(perm, resourceType, resourceId));
      if (!hasAccess) {
        const missingPerms = permissions.filter(perm => !hasPermission(perm, resourceType, resourceId));
        denialReason = `Missing required permissions: ${missingPerms.join(', ')}`;
      }
    } else {
      // OR logic - user must have ANY permission
      hasAccess = permissions.some(perm => hasPermission(perm, resourceType, resourceId));
      if (!hasAccess) {
        denialReason = `Missing any of required permissions: ${permissions.join(', ')}`;
      }
    }
  }

  // If no specific checks were provided, allow access (open gate)
  if (!allowedRoles && !securityRoles && !permission && !permissions) {
    hasAccess = true;
  }

  // Log access attempts if requested
  if (logAccess) {
    console.log('PermissionGate Access Check:', {
      userId: user.id,
      userRole: user.role,
      permission,
      permissions,
      allowedRoles,
      securityRoles,
      hasAccess,
      denialReason: hasAccess ? null : denialReason,
      timestamp: new Date().toISOString()
    });
  }

  // Handle access denied
  if (!hasAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }
    
    if (showAccessDenied) {
      return (
        <div className="flex items-center justify-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800" data-testid="permission-gate-denied">
          <div className="text-center space-y-2">
            <ShieldAlert className="h-8 w-8 text-red-500 mx-auto" />
            <h3 className="font-medium text-red-900 dark:text-red-200">Access Restricted</h3>
            <p className="text-sm text-red-700 dark:text-red-300">{denialReason}</p>
          </div>
        </div>
      );
    }
    
    // Return null to hide content when access is denied
    return null;
  }

  // Render children when access is granted
  return <>{children}</>;
}

// Specialized permission gates for common use cases
export function CameraPermissionGate({ 
  action, 
  cameraId, 
  children, 
  ...props 
}: Omit<PermissionGateProps, 'permission' | 'resourceType' | 'resourceId'> & {
  action: 'view' | 'control' | 'configure' | 'history';
  cameraId?: string;
}) {
  return (
    <PermissionGate
      permission={`cameras:${action}`}
      resourceType="camera"
      resourceId={cameraId}
      {...props}
    >
      {children}
    </PermissionGate>
  );
}

export function AlertPermissionGate({ 
  action, 
  alertId, 
  children, 
  ...props 
}: Omit<PermissionGateProps, 'permission' | 'resourceType' | 'resourceId'> & {
  action: 'receive' | 'acknowledge' | 'dismiss' | 'escalate' | 'manage' | 'configure';
  alertId?: string;
}) {
  return (
    <PermissionGate
      permission={`alerts:${action}`}
      resourceType="alert"
      resourceId={alertId}
      {...props}
    >
      {children}
    </PermissionGate>
  );
}

export function IncidentPermissionGate({ 
  action, 
  incidentId, 
  children, 
  ...props 
}: Omit<PermissionGateProps, 'permission' | 'resourceType' | 'resourceId'> & {
  action: 'create' | 'investigate' | 'assign' | 'resolve' | 'close';
  incidentId?: string;
}) {
  return (
    <PermissionGate
      permission={`incidents:${action}`}
      resourceType="incident"
      resourceId={incidentId}
      {...props}
    >
      {children}
    </PermissionGate>
  );
}

export function EvidencePermissionGate({ 
  action, 
  evidenceId, 
  children, 
  ...props 
}: Omit<PermissionGateProps, 'permission' | 'resourceType' | 'resourceId'> & {
  action: 'upload' | 'view' | 'download' | 'manage' | 'audit';
  evidenceId?: string;
}) {
  return (
    <PermissionGate
      permission={`evidence:${action}`}
      resourceType="evidence"
      resourceId={evidenceId}
      {...props}
    >
      {children}
    </PermissionGate>
  );
}

export function AnalyticsPermissionGate({ 
  action, 
  children, 
  ...props 
}: Omit<PermissionGateProps, 'permission' | 'resourceType'> & {
  action: 'executive' | 'operational' | 'safety' | 'public' | 'reports' | 'export';
}) {
  return (
    <PermissionGate
      permission={`analytics:${action}`}
      resourceType="analytics"
      {...props}
    >
      {children}
    </PermissionGate>
  );
}

export function UserManagementGate({ 
  action, 
  userId, 
  children, 
  ...props 
}: Omit<PermissionGateProps, 'permission' | 'resourceType' | 'resourceId'> & {
  action: 'view' | 'create' | 'edit' | 'delete' | 'assign_roles';
  userId?: string;
}) {
  return (
    <PermissionGate
      permission={`users:${action}`}
      resourceType="user"
      resourceId={userId}
      {...props}
    >
      {children}
    </PermissionGate>
  );
}

export function SystemPermissionGate({ 
  action, 
  children, 
  ...props 
}: Omit<PermissionGateProps, 'permission' | 'resourceType'> & {
  action: 'configure' | 'audit' | 'backup' | 'maintenance';
}) {
  return (
    <PermissionGate
      permission={`system:${action}`}
      resourceType="system"
      {...props}
    >
      {children}
    </PermissionGate>
  );
}

// Security role gates for common combinations
export function SecurityManagerGate({ children, ...props }: Omit<PermissionGateProps, 'securityRoles'>) {
  return (
    <PermissionGate securityRoles={['admin']} {...props}>
      {children}
    </PermissionGate>
  );
}

export function SecurityPersonnelGate({ children, ...props }: Omit<PermissionGateProps, 'securityRoles'>) {
  return (
    <PermissionGate securityRoles={['admin', 'security_personnel']} {...props}>
      {children}
    </PermissionGate>
  );
}

export function SafetyCoordinatorGate({ children, ...props }: Omit<PermissionGateProps, 'securityRoles'>) {
  return (
    <PermissionGate securityRoles={['admin', 'security_personnel', 'safety_coordinator']} {...props}>
      {children}
    </PermissionGate>
  );
}

export function SecurityAccessGate({ children, ...props }: Omit<PermissionGateProps, 'securityRoles'>) {
  return (
    <PermissionGate securityRoles={['admin', 'security_personnel', 'safety_coordinator', 'guest']} {...props}>
      {children}
    </PermissionGate>
  );
}

// Utility component for showing different content based on security clearance
interface SecurityClearanceContentProps {
  children: ReactNode;
  adminContent?: ReactNode;
  securityPersonnelContent?: ReactNode;
  safetyCoordinatorContent?: ReactNode;
  guestContent?: ReactNode;
  fallback?: ReactNode;
}

export function SecurityClearanceContent({
  children,
  adminContent,
  securityPersonnelContent,
  safetyCoordinatorContent,
  guestContent,
  fallback
}: SecurityClearanceContentProps) {
  const { isSecurityManager, isGuardOfficer, isSafetyCoordinator, isVisitor } = useSecurityRole();

  if (isSecurityManager() && adminContent) {
    return <>{adminContent}</>;
  }
  
  if (isGuardOfficer() && securityPersonnelContent) {
    return <>{securityPersonnelContent}</>;
  }
  
  if (isSafetyCoordinator() && safetyCoordinatorContent) {
    return <>{safetyCoordinatorContent}</>;
  }
  
  if (isVisitor() && guestContent) {
    return <>{guestContent}</>;
  }

  if (children) {
    return <>{children}</>;
  }

  return fallback ? <>{fallback}</> : null;
}

// HOC for protecting components with permissions
export function withPermissions<P extends object>(
  Component: React.ComponentType<P>,
  permissionProps: Omit<PermissionGateProps, 'children'>
) {
  return function PermissionProtectedComponent(props: P) {
    return (
      <PermissionGate {...permissionProps}>
        <Component {...props} />
      </PermissionGate>
    );
  };
}

export default PermissionGate;
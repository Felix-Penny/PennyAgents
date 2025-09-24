// Enhanced Penny MVP Protected Route - Based on javascript_auth_all_persistance integration
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { Loader2, ShieldAlert } from "lucide-react";
import { Redirect, Route } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
  // Legacy role-based access (backward compatibility)
  allowedRoles,
  // Enhanced permission-based access
  permission,
  permissions,
  requireAll = false,
  resourceType,
  resourceId,
  securityRoles,
  // Logging and debugging
  logAccess = false,
}: {
  path: string;
  component: () => React.JSX.Element;
  // Legacy role support
  allowedRoles?: string[];
  // New permission system
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
  resourceType?: string;
  resourceId?: string;
  securityRoles?: string[];
  // Audit logging
  logAccess?: boolean;
}) {
  const { user, isLoading } = useAuth();
  
  // Enhanced permission component that supports permission checking
  function PermissionProtectedComponent() {
    return <PermissionAwareRoute />;
  }

  function PermissionAwareRoute() {
    const { hasPermission, hasSecurityRole, isLoading: permissionsLoading } = usePermissions();

    if (isLoading || permissionsLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
            <p className="text-gray-600 dark:text-gray-300">Loading Penny Security...</p>
          </div>
        </div>
      );
    }

    if (!user) {
      return <Redirect to="/" />;
    }

    let hasAccess = false;
    let denialReason = "Access denied";

    // Check legacy role-based access first (backward compatibility)
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

    // If no specific checks were provided, fall back to basic authentication
    if (!allowedRoles && !securityRoles && !permission && !permissions) {
      hasAccess = true;
    }

    // Log access attempts if requested
    if (logAccess) {
      console.log('ProtectedRoute Access Check:', {
        path,
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
      return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-white dark:from-gray-900 dark:to-gray-800">
          <div className="text-center space-y-4 p-8" data-testid="protected-route-access-denied">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto">
              <ShieldAlert className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Access Denied</h1>
            <p className="text-gray-600 dark:text-gray-400">
              You don't have permission to access this area.
            </p>
            <div className="text-sm text-gray-500 dark:text-gray-500 space-y-1">
              <p>Current role: <span className="font-medium">{user.role?.replace('_', ' ') || 'No role assigned'}</span></p>
              <p className="text-xs">Reason: {denialReason}</p>
            </div>
          </div>
        </div>
      );
    }

    // Render the protected component when access is granted
    return <Component />;
  }

  // Authentication check before permission checks
  if (isLoading) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-white dark:from-gray-900 dark:to-gray-800">
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
            <p className="text-gray-600 dark:text-gray-300">Loading Penny Security...</p>
          </div>
        </div>
      </Route>
    );
  }

  if (!user) {
    return (
      <Route path={path}>
        <Redirect to="/" />
      </Route>
    );
  }

  // Use permission-aware component if any permission checks are specified
  if (permission || permissions || securityRoles) {
    return <Route path={path} component={PermissionProtectedComponent} />;
  }

  // Fall back to legacy role checking if only allowedRoles is specified
  if (allowedRoles && user.role && !allowedRoles.includes(user.role)) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-white dark:from-gray-900 dark:to-gray-800">
          <div className="text-center space-y-4 p-8">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto">
              <ShieldAlert className="w-8 h-8 text-red-600 dark:text-red-400" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Access Denied</h1>
            <p className="text-gray-600 dark:text-gray-400">
              You don't have permission to access this area.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Current role: <span className="font-medium">{user.role?.replace('_', ' ') || 'No role assigned'}</span>
            </p>
          </div>
        </div>
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}
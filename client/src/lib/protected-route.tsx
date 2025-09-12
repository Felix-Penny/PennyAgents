// Penny MVP Protected Route - Based on javascript_auth_all_persistance integration
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";
import { Redirect, Route } from "wouter";

export function ProtectedRoute({
  path,
  component: Component,
  allowedRoles,
}: {
  path: string;
  component: () => React.JSX.Element;
  allowedRoles?: string[];
}) {
  const { user, isLoading } = useAuth();

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
        <Redirect to="/auth" />
      </Route>
    );
  }

  // Check role-based access if roles are specified
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <Route path={path}>
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-white dark:from-gray-900 dark:to-gray-800">
          <div className="text-center space-y-4 p-8">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto">
              <span className="text-red-600 dark:text-red-400 text-2xl">🚫</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Access Denied</h1>
            <p className="text-gray-600 dark:text-gray-400">
              You don't have permission to access this area.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              Current role: <span className="font-medium">{user.role.replace('_', ' ')}</span>
            </p>
          </div>
        </div>
      </Route>
    );
  }

  return <Route path={path} component={Component} />;
}
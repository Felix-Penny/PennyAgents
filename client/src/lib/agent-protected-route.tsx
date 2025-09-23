import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useEffect } from "react";

type AgentProtectedRouteProps = {
  children: React.ReactNode;
  agentId: string;
  minimumRole?: "viewer" | "operator" | "admin";
  fallbackPath?: string;
};

type UserAgentAccess = {
  id: string;
  userId: string;
  agentId: string;
  role: string;
  isActive: boolean;
  agent: {
    id: string;
    name: string;
    isActive: boolean;
    category: string;
    description: string;
    baseRoute: string;
    minimumRole: string | null;
  };
  grantedAt: string;
};

export function AgentProtectedRoute({ 
  children, 
  agentId, 
  minimumRole,
  fallbackPath = "/platform" 
}: AgentProtectedRouteProps) {
  const { user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();

  const { data: userAgents = [], isLoading: agentsLoading } = useQuery<UserAgentAccess[]>({
    queryKey: ["/api/user/agents"],
    enabled: !!user,
    queryFn: async () => {
      const response = await fetch("/api/user/agents", { credentials: "include" });
      if (!response.ok) throw new Error(`Failed to fetch user agents: ${response.status}`);
      return response.json();
    }
  });

  useEffect(() => {
    console.log("🔐 AgentProtectedRoute effect:", { 
      agentId, 
      authLoading, 
      agentsLoading, 
      userCount: userAgents.length,
      user: user?.username 
    });

    if (authLoading || agentsLoading) return;

    if (!user) {
      console.log("❌ No user, redirecting to login");
      setLocation("/login");
      return;
    }

    // Check if user has access to this agent
    const agentAccess = userAgents.find(ua => ua.agentId === agentId && ua.isActive);
    console.log("🔍 Agent access check:", { 
      agentId, 
      agentAccess: !!agentAccess,
      agentData: agentAccess?.agent,
      userAgentsCount: userAgents.length 
    });
    
    if (!agentAccess) {
      console.log("❌ No agent access, redirecting to platform");
      setLocation(fallbackPath);
      return;
    }

    // Check minimum role requirement if specified
    if (minimumRole) {
      const roleHierarchy = ["viewer", "operator", "admin"];
      const userRoleLevel = roleHierarchy.indexOf(agentAccess.role);
      const requiredRoleLevel = roleHierarchy.indexOf(minimumRole);

      if (userRoleLevel < requiredRoleLevel) {
        console.log("❌ Insufficient role, redirecting to platform");
        setLocation(fallbackPath);
        return;
      }
    }

    // Check if agent itself is active
    if (!agentAccess.agent?.isActive) {
      console.log("❌ Agent not active, redirecting to platform");
      setLocation(fallbackPath);
      return;
    }

    console.log("✅ Agent access granted, rendering children");
  }, [user, userAgents, authLoading, agentsLoading, agentId, minimumRole, fallbackPath, setLocation]);

  // Show loading state while checking authentication and permissions
  if (authLoading || agentsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" data-testid="agent-route-loading">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Checking agent access...</p>
        </div>
      </div>
    );
  }

  // Don't render children until we've verified access
  if (!user) {
    console.log("🔐 No user for final render check");
    return null;
  }
  
  const agentAccess = userAgents.find(ua => ua.agentId === agentId && ua.isActive);
  if (!agentAccess || !agentAccess.agent?.isActive) {
    console.log("🔐 No valid agent access for final render:", { agentAccess: !!agentAccess, agentActive: agentAccess?.agent?.isActive });
    return null;
  }

  // Check minimum role one more time
  if (minimumRole) {
    const roleHierarchy = ["viewer", "operator", "admin"];
    const userRoleLevel = roleHierarchy.indexOf(agentAccess.role);
    const requiredRoleLevel = roleHierarchy.indexOf(minimumRole);

    if (userRoleLevel < requiredRoleLevel) {
      console.log("🔐 Insufficient role for final render");
      return null;
    }
  }

  console.log("🎉 Rendering children for agent:", agentId);
  return <>{children}</>;
}
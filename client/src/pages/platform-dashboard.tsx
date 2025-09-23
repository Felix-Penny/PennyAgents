import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shield, DollarSign, TrendingUp, Settings, Users, ArrowRight } from "lucide-react";
import { Link } from "wouter";

type Agent = {
  id: string;
  name: string;
  isActive: boolean;
  category: string;
  description: string;
  baseRoute: string;
  minimumRole: string | null;
};

type UserAgentAccess = {
  id: string;
  userId: string;
  agentId: string;
  role: string;
  isActive: boolean;
  agent: Agent;
  grantedAt: string;
};

// Agent icons mapping
const agentIcons = {
  security: Shield,
  finance: DollarSign,
  sales: TrendingUp,
  operations: Settings,
  hr: Users,
};

export default function PlatformDashboard() {
  const { data: agents = [], isLoading: agentsLoading, error: agentsError } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
    queryFn: async () => {
      const response = await fetch("/api/agents", { credentials: "include" });
      if (!response.ok) throw new Error(`Failed to fetch agents: ${response.status}`);
      return response.json();
    }
  });

  const { data: userAgents = [], isLoading: userAgentsLoading, error: userAgentsError } = useQuery<UserAgentAccess[]>({
    queryKey: ["/api/user/agents"],
    queryFn: async () => {
      const response = await fetch("/api/user/agents", { credentials: "include" });
      if (!response.ok) throw new Error(`Failed to fetch user agents: ${response.status}`);
      return response.json();
    }
  });

  if (agentsLoading || userAgentsLoading) {
    return (
      <div className="container mx-auto p-6" data-testid="platform-dashboard-loading">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
                <div className="w-32 h-6 bg-gray-300 dark:bg-gray-600 rounded"></div>
                <div className="w-48 h-4 bg-gray-300 dark:bg-gray-600 rounded"></div>
              </CardHeader>
              <CardContent>
                <div className="w-24 h-8 bg-gray-300 dark:bg-gray-600 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Create map of user's agent access for quick lookup
  const userAgentMap = new Map(userAgents.map(ua => [ua.agentId, ua]));

  const getAgentIcon = (category: string) => {
    const IconComponent = agentIcons[category as keyof typeof agentIcons] || Settings;
    return IconComponent;
  };

  return (
    <div className="container mx-auto p-6" data-testid="platform-dashboard">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2" data-testid="dashboard-title">
          Penny Multi-Agent Platform
        </h1>
        <p className="text-gray-600 dark:text-gray-300" data-testid="dashboard-description">
          Access and manage your business intelligence agents across different sectors
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {agents.map((agent) => {
          const userAccess = userAgentMap.get(agent.id);
          const hasAccess = userAccess && userAccess.isActive;
          const IconComponent = getAgentIcon(agent.category);

          return (
            <Card 
              key={agent.id} 
              className={`transition-all duration-200 hover:shadow-lg ${
                hasAccess 
                  ? 'border-green-200 dark:border-green-800' 
                  : 'border-gray-200 dark:border-gray-700'
              }`}
              data-testid={`agent-card-${agent.id}`}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg ${
                      hasAccess 
                        ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400' 
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}>
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg" data-testid={`agent-name-${agent.id}`}>
                        {agent.name}
                      </CardTitle>
                      <Badge 
                        variant={agent.isActive ? "default" : "secondary"}
                        className="text-xs"
                        data-testid={`agent-status-${agent.id}`}
                      >
                        {agent.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    {hasAccess && (
                      <Badge variant="outline" className="text-xs mb-1" data-testid={`user-role-${agent.id}`}>
                        {userAccess.role}
                      </Badge>
                    )}
                    <Badge 
                      variant={hasAccess ? "default" : "secondary"}
                      className="text-xs"
                      data-testid={`access-status-${agent.id}`}
                    >
                      {hasAccess ? "Access Granted" : "No Access"}
                    </Badge>
                  </div>
                </div>
                <CardDescription data-testid={`agent-description-${agent.id}`}>
                  {agent.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {hasAccess ? (
                  <Link href={agent.baseRoute}>
                    <Button className="w-full" data-testid={`button-access-${agent.id}`}>
                      Access {agent.name}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                  </Link>
                ) : (
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    disabled
                    data-testid={`button-request-${agent.id}`}
                  >
                    Request Access
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {agents.length === 0 && (
        <div className="text-center py-12" data-testid="no-agents-message">
          <p className="text-gray-500 dark:text-gray-400">No agents available at this time.</p>
        </div>
      )}
    </div>
  );
}
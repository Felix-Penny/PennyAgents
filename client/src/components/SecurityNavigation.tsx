import { useState } from "react";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  BarChart3,
  Camera,
  AlertTriangle,
  FileText,
  Users,
  Settings,
  Network,
  Brain,
  Upload,
  TestTube,
  Shield,
  Menu,
  X,
  Home
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

const securityRoutes = [
  {
    name: "Dashboard",
    path: "/security/dashboard",
    icon: Home,
    description: "Main security overview"
  },
  {
    name: "Live Feeds",
    path: "/security/live-feeds", 
    icon: Camera,
    description: "Monitor live camera feeds"
  },
  {
    name: "Alerts",
    path: "/security/alerts",
    icon: AlertTriangle,
    description: "Security alerts and notifications"
  },
  {
    name: "Incidents", 
    path: "/security/incidents",
    icon: FileText,
    description: "Incident reports and tracking"
  },
  {
    name: "Offenders",
    path: "/security/offenders",
    icon: Users,
    description: "Known offender database"
  },
  {
    name: "Analytics",
    path: "/security/analytics", 
    icon: BarChart3,
    description: "Security analytics dashboard"
  },
  {
    name: "Predictive Analytics",
    path: "/security/predictive-analytics",
    icon: Brain,
    description: "AI-powered threat prediction"
  },
  {
    name: "Facial Recognition",
    path: "/security/facial-recognition",
    icon: Shield,
    description: "Facial recognition system"
  },
  {
    name: "Video Upload",
    path: "/security/video-upload",
    icon: Upload,
    description: "Upload and analyze video footage"
  },
  {
    name: "Video Test",
    path: "/security/video-test",
    icon: TestTube,
    description: "Test video feeds and detection"
  },
  {
    name: "Network",
    path: "/security/network",
    icon: Network,
    description: "Network intelligence sharing"
  },
  {
    name: "Settings",
    path: "/security/settings",
    icon: Settings,
    description: "System configuration"
  }
];

export function SecurityNavigation() {
  const [location] = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { user } = useAuth();

  if (!location.startsWith('/security')) {
    return null;
  }

  return (
    <nav className={cn(
      "fixed top-0 left-0 h-full bg-background border-r border-border transition-all duration-300 z-50",
      isCollapsed ? "w-16" : "w-64"
    )}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          {!isCollapsed && (
            <div className="flex items-center space-x-2">
              <Shield className="h-6 w-6 text-blue-600" />
              <span className="font-bold text-lg">PENNY Security</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8"
            data-testid="button-toggle-nav"
          >
            {isCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </Button>
        </div>

        {/* User Info */}
        {!isCollapsed && user && (
          <div className="p-4 border-b bg-muted/50">
            <div className="text-sm font-medium">{user.username}</div>
            <div className="text-xs text-muted-foreground">{user.role}</div>
          </div>
        )}

        {/* Navigation Links */}
        <div className="flex-1 overflow-y-auto py-4">
          <div className="space-y-1 px-2">
            {securityRoutes.map((route) => {
              const Icon = route.icon;
              const isActive = location === route.path;
              
              return (
                <Link 
                  key={route.path} 
                  href={route.path}
                  className="block"
                  data-testid={`link-nav-${route.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <Button
                    variant={isActive ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start h-10 text-left",
                      isActive && "bg-secondary text-secondary-foreground font-medium",
                      isCollapsed ? "px-2" : "px-3"
                    )}
                  >
                    <Icon className={cn("h-4 w-4", isCollapsed ? "mx-0" : "mr-3")} />
                    {!isCollapsed && (
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{route.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {route.description}
                        </div>
                      </div>
                    )}
                  </Button>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t p-4">
          {!isCollapsed && (
            <div className="text-xs text-muted-foreground text-center">
              PENNY Security Platform
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
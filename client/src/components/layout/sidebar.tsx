import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, BarChart3, Video, AlertTriangle, Users, Network, Settings, Home } from "lucide-react";
import { useLocation, Link } from "wouter";
import pennyLogoPath from "@assets/Penny-logo.png";

const sidebarItems = [
  {
    title: "Dashboard",
    href: "/",
    icon: Home,
  },
  {
    title: "Live Feeds",
    href: "/live-feeds",
    icon: Video,
  },
  {
    title: "Alerts",
    href: "/alerts",
    icon: AlertTriangle,
  },
  {
    title: "Offender Database",
    href: "/offenders",
    icon: Users,
  },
  {
    title: "Analytics", 
    href: "/analytics",
    icon: BarChart3,
  },
  {
    title: "Network Intel",
    href: "/network",
    icon: Network,
  },
  {
    title: "Settings",
    href: "/settings",
    icon: Settings,
  },
];

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r border-border flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <img src={pennyLogoPath} alt="PENNY" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">PENNY</h1>
              <p className="text-xs text-muted-foreground">Security Network</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 p-4">
          <nav className="space-y-2">
            {sidebarItems.map((item) => {
              const isActive = location === item.href;
              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant={isActive ? "default" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-3",
                      isActive && "bg-primary text-primary-foreground"
                    )}
                    data-testid={`nav-${item.href.replace('/', '') || 'dashboard'}`}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.title}
                    {item.href === '/alerts' && (
                      <span className="bg-destructive text-destructive-foreground text-xs px-2 py-1 rounded-full ml-auto">
                        3
                      </span>
                    )}
                  </Button>
                </Link>
              );
            })}
          </nav>
        </ScrollArea>

        {/* User Info */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-muted rounded-full flex items-center justify-center">
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">Store Manager</p>
              <p className="text-xs text-muted-foreground truncate">Downtown Location</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      {children}
    </div>
  );
}

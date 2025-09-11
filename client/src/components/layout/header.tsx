import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertTriangle } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle: string;
  alertCount: number;
  networkStatus: "active" | "inactive" | "connecting";
}

export function Header({ title, subtitle, alertCount, networkStatus }: HeaderProps) {
  const getNetworkStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'inactive': return 'bg-red-500';
      case 'connecting': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <header className="bg-card border-b border-border px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
          <p className="text-muted-foreground">{subtitle}</p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Network Status */}
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 ${getNetworkStatusColor(networkStatus)} rounded-full animate-pulse`}></div>
            <span className="text-sm text-muted-foreground">
              Network {networkStatus === 'active' ? 'Active' : networkStatus === 'inactive' ? 'Inactive' : 'Connecting'}
            </span>
          </div>
          
          {/* Active Alerts */}
          <Button 
            variant="ghost" 
            size="sm" 
            className="relative p-2 text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-notifications"
          >
            <Bell className="h-5 w-5" />
            {alertCount > 0 && (
              <Badge 
                variant="destructive" 
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs animate-blink"
              >
                {alertCount}
              </Badge>
            )}
          </Button>
          
          {/* Emergency Button */}
          <Button 
            variant="destructive" 
            size="sm"
            className="font-medium"
            data-testid="button-emergency"
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Emergency
          </Button>
        </div>
      </div>
    </header>
  );
}

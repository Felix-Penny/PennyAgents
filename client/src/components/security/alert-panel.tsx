import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, MapPin } from "lucide-react";
import type { AlertWithRelations } from "@shared/schema";

interface AlertPanelProps {
  alerts: AlertWithRelations[];
  onAlertClick?: (alert: AlertWithRelations) => void;
}

export function AlertPanel({ alerts, onAlertClick }: AlertPanelProps) {
  const getAlertIcon = (severity: string) => {
    return <AlertTriangle className={`h-4 w-4 ${getSeverityColor(severity)}`} />;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-500';
      case 'high': return 'text-orange-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  const getSeverityBadgeColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-black';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getTypeLabel = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const alertTime = new Date(date);
    const diffMs = now.getTime() - alertTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Active Alerts</CardTitle>
        <span className="text-xs text-muted-foreground">
          Last updated: <span className="font-medium">2 sec ago</span>
        </span>
      </CardHeader>
      
      <CardContent>
        {alerts.length === 0 ? (
          <div className="text-center py-8">
            <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No active alerts</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <div 
                key={alert.id} 
                className={`flex items-start space-x-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                  alert.severity === 'critical' ? 'bg-destructive/10 border-destructive/20' :
                  alert.severity === 'high' ? 'bg-orange-500/10 border-orange-500/20' :
                  alert.severity === 'medium' ? 'bg-yellow-500/10 border-yellow-500/20' :
                  'bg-blue-500/10 border-blue-500/20'
                }`}
                onClick={() => onAlertClick?.(alert)}
                data-testid={`alert-${alert.id}`}
              >
                <div className="flex-shrink-0 mt-1">
                  <div className={`w-2 h-2 ${getSeverityColor(alert.severity).replace('text-', 'bg-')} rounded-full animate-pulse`}></div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className={`text-sm font-medium ${getSeverityColor(alert.severity)}`}>
                      {alert.title}
                    </h3>
                    <Badge className={`text-xs ${getSeverityBadgeColor(alert.severity)}`}>
                      {alert.severity}
                    </Badge>
                  </div>
                  
                  <p className="text-xs text-muted-foreground mb-2">
                    {alert.message}
                  </p>
                  
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {alert.camera && (
                      <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span>{alert.camera.name}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatTimeAgo(alert.createdAt)}</span>
                    </div>
                  </div>
                </div>
                
                <Button 
                  size="sm" 
                  variant="outline"
                  className={`text-xs ${getSeverityColor(alert.severity)} border-current hover:bg-current hover:text-white`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onAlertClick?.(alert);
                  }}
                  data-testid={`button-view-alert-${alert.id}`}
                >
                  View
                </Button>
              </div>
            ))}
          </div>
        )}
        
        {alerts.length > 0 && (
          <Button 
            variant="link" 
            size="sm" 
            className="w-full mt-4 text-primary hover:text-primary/80 transition-colors"
            data-testid="button-view-all-alerts"
          >
            View All Alerts →
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

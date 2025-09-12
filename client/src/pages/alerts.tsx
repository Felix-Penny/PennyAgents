import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle, XCircle, Clock, Eye } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

type AlertSeverity = "low" | "medium" | "high" | "critical";
type AlertType = "theft_in_progress" | "known_offender_entry" | "aggressive_behavior" | "suspicious_activity" | "system_alert";

type DatabaseAlert = {
  id: string;
  storeId: string;
  cameraId: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  isRead: boolean;
  isActive: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
  createdAt: string;
};

type SecurityAlert = {
  id: string;
  title: string;
  description: string;
  status: "NEW" | "PENDING_REVIEW" | "CONFIRMED" | "DISMISSED";
  severity: "HIGH" | "MEDIUM" | "LOW";
  detectedAt: string;
  location: string;
  cameraId: string;
  thumbnailUrl?: string;
  confidence: number;
};

export default function Alerts() {
  const { user } = useAuth();
  
  // Fetch real alerts from API - get ALL alerts for the store
  const { data: dbAlerts, isLoading } = useQuery<DatabaseAlert[]>({
    queryKey: ['/api/alerts', user?.storeId],
    queryFn: async (): Promise<DatabaseAlert[]> => {
      if (!user?.storeId) throw new Error('No store ID available');
      // Use the getAlertsByStore endpoint to get ALL alerts, not just active ones
      const response = await fetch(`/api/alerts/${user.storeId}`);
      if (!response.ok) throw new Error('Failed to fetch alerts');
      return response.json();
    },
    enabled: !!user?.storeId,
  });
  
  // Transform database alerts to frontend format
  const alerts: SecurityAlert[] = (dbAlerts || []).map(alert => ({
    id: alert.id,
    title: alert.title,
    description: alert.message,
    status: alert.isRead ? (alert.isActive ? "CONFIRMED" : "DISMISSED") : (alert.isActive ? "NEW" : "DISMISSED"),
    severity: (alert.severity === 'high' ? 'HIGH' : alert.severity === 'medium' ? 'MEDIUM' : alert.severity === 'critical' ? 'HIGH' : 'LOW') as "HIGH" | "MEDIUM" | "LOW",
    detectedAt: formatTimeAgo(alert.createdAt || ''),
    location: getCameraLocation(alert.cameraId || ''),
    cameraId: alert.cameraId || 'unknown',
    confidence: 85 // Default confidence since not in current schema
  }));
  
  function formatTimeAgo(dateString: string): string {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return 'Unknown time';
      }
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      
      if (diffMinutes < 1) return 'Just now';
      if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
      
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
      
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return 'Unknown time';
    }
  }
  
  function getCameraLocation(cameraId: string): string {
    const locations: Record<string, string> = {
      'cam-001': 'Main Entrance',
      'cam-003': 'Electronics Section - Aisle 5',
      'cam-004': 'Pharmacy Section',
      'cam-005': 'Stockroom'
    };
    return locations[cameraId] || `Camera ${cameraId}`;
  }
  
  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Clock className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p>Loading alerts...</p>
          </div>
        </div>
      </div>
    );
  }

  const getStatusBadge = (status: "NEW" | "PENDING_REVIEW" | "CONFIRMED" | "DISMISSED") => {
    switch (status) {
      case "NEW":
        return <Badge className="bg-red-100 text-red-800">New</Badge>;
      case "PENDING_REVIEW":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending Review</Badge>;
      case "CONFIRMED":
        return <Badge className="bg-blue-100 text-blue-800">Confirmed</Badge>;
      case "DISMISSED":
        return <Badge className="bg-gray-100 text-gray-800">Dismissed</Badge>;
    }
  };

  const getSeverityBadge = (severity: "HIGH" | "MEDIUM" | "LOW") => {
    switch (severity) {
      case "HIGH":
        return <Badge variant="destructive">High Priority</Badge>;
      case "MEDIUM":
        return <Badge className="bg-orange-100 text-orange-800">Medium Priority</Badge>;
      case "LOW":
        return <Badge variant="secondary">Low Priority</Badge>;
    }
  };

  const getSeverityIcon = (severity: "HIGH" | "MEDIUM" | "LOW") => {
    switch (severity) {
      case "HIGH":
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      case "MEDIUM":
        return <Clock className="h-4 w-4 text-orange-600" />;
      case "LOW":
        return <Eye className="h-4 w-4 text-blue-600" />;
    }
  };

  const filterAlertsByStatus = (status?: AlertStatus) => {
    return status ? alerts.filter(alert => alert.status === status) : alerts;
  };

  const AlertCard = ({ alert }: { alert: SecurityAlert }) => (
    <Card className="mb-4" data-testid={`card-alert-${alert.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getSeverityIcon(alert.severity)}
            <CardTitle className="text-lg">{alert.title}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {getSeverityBadge(alert.severity)}
            {getStatusBadge(alert.status)}
          </div>
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>{alert.location}</span>
          <span>{alert.detectedAt}</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm">{alert.description}</p>
        
        {/* Confidence Score */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Confidence:</span>
          <Badge variant="outline">{alert.confidence}%</Badge>
        </div>

        {/* Alert Actions */}
        <div className="flex gap-2">
          {alert.status === "NEW" && (
            <>
              <Button 
                size="sm" 
                data-testid={`button-confirm-${alert.id}`}
                className="bg-red-600 hover:bg-red-700"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Confirm Threat
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                data-testid={`button-dismiss-${alert.id}`}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Dismiss
              </Button>
            </>
          )}
          {alert.status === "PENDING_REVIEW" && (
            <>
              <Button 
                size="sm"
                data-testid={`button-review-${alert.id}`}
              >
                <Eye className="h-4 w-4 mr-1" />
                Review Evidence
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                data-testid={`button-escalate-${alert.id}`}
              >
                Escalate
              </Button>
            </>
          )}
          <Button 
            size="sm" 
            variant="ghost"
            data-testid={`button-view-camera-${alert.id}`}
          >
            <Eye className="h-4 w-4 mr-1" />
            View Camera
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Security Alerts</h1>
          <p className="text-muted-foreground">Monitor and respond to security threats</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="text-red-600">
            {filterAlertsByStatus("NEW").length} New Alerts
          </Badge>
          <Badge variant="outline" className="text-yellow-600">
            {filterAlertsByStatus("PENDING_REVIEW").length} Pending Review
          </Badge>
        </div>
      </div>

      {/* Alert Tabs */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="active">Active Alerts ({filterAlertsByStatus("NEW").length + filterAlertsByStatus("PENDING_REVIEW").length})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({filterAlertsByStatus("CONFIRMED").length + filterAlertsByStatus("DISMISSED").length})</TabsTrigger>
          <TabsTrigger value="all">All Alerts ({alerts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {filterAlertsByStatus("NEW").concat(filterAlertsByStatus("PENDING_REVIEW")).length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-medium mb-2">No Active Alerts</h3>
                <p className="text-muted-foreground">All alerts have been resolved. Great job!</p>
              </CardContent>
            </Card>
          ) : (
            filterAlertsByStatus("NEW").concat(filterAlertsByStatus("PENDING_REVIEW"))
              .sort((a, b) => {
                const severityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
                return severityOrder[b.severity] - severityOrder[a.severity];
              })
              .map(alert => <AlertCard key={alert.id} alert={alert} />)
          )}
        </TabsContent>

        <TabsContent value="resolved" className="space-y-4">
          {filterAlertsByStatus("CONFIRMED").concat(filterAlertsByStatus("DISMISSED"))
            .map(alert => <AlertCard key={alert.id} alert={alert} />)}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          {alerts.map(alert => <AlertCard key={alert.id} alert={alert} />)}
        </TabsContent>
      </Tabs>
    </div>
  );
}
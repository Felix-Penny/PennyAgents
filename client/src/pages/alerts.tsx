import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, CheckCircle, XCircle, Clock, Eye } from "lucide-react";

type AlertStatus = "NEW" | "PENDING_REVIEW" | "CONFIRMED" | "DISMISSED";
type AlertSeverity = "HIGH" | "MEDIUM" | "LOW";

type SecurityAlert = {
  id: string;
  title: string;
  description: string;
  status: AlertStatus;
  severity: AlertSeverity;
  detectedAt: string;
  location: string;
  cameraId: string;
  thumbnailUrl?: string;
  confidence: number;
};

export default function Alerts() {
  const [alerts] = useState<SecurityAlert[]>([
    {
      id: "alert-001",
      title: "Potential Shoplifting Activity",
      description: "Suspicious behavior detected at electronics section",
      status: "NEW",
      severity: "HIGH",
      detectedAt: "2 minutes ago",
      location: "Electronics Section - Aisle 5",
      cameraId: "cam-003",
      confidence: 87
    },
    {
      id: "alert-002",
      title: "Known Offender Detected",
      description: "Person matching offender database entry",
      status: "PENDING_REVIEW",
      severity: "HIGH",
      detectedAt: "5 minutes ago",
      location: "Main Entrance",
      cameraId: "cam-001",
      confidence: 92
    },
    {
      id: "alert-003",
      title: "Unusual Loitering",
      description: "Person standing in one location for extended period",
      status: "CONFIRMED",
      severity: "MEDIUM",
      detectedAt: "15 minutes ago",
      location: "Pharmacy Section",
      cameraId: "cam-004",
      confidence: 76
    },
    {
      id: "alert-004",
      title: "After-Hours Movement",
      description: "Motion detected during closed hours",
      status: "DISMISSED",
      severity: "LOW",
      detectedAt: "2 hours ago",
      location: "Stockroom",
      cameraId: "cam-005",
      confidence: 64
    }
  ]);

  const getStatusBadge = (status: AlertStatus) => {
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

  const getSeverityBadge = (severity: AlertSeverity) => {
    switch (severity) {
      case "HIGH":
        return <Badge variant="destructive">High Priority</Badge>;
      case "MEDIUM":
        return <Badge className="bg-orange-100 text-orange-800">Medium Priority</Badge>;
      case "LOW":
        return <Badge variant="secondary">Low Priority</Badge>;
    }
  };

  const getSeverityIcon = (severity: AlertSeverity) => {
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
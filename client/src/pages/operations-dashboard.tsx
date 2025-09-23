import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Settings, Package, Clock, CheckCircle, AlertCircle, Activity } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function OperationsDashboard() {
  const { user } = useAuth();

  const operationsStats = {
    activeProcesses: 24,
    completedTasks: 187,
    efficiencyRate: 94.2,
    uptime: 99.7,
    pendingApprovals: 8,
    resourceUtilization: 87
  };

  const activeProcesses = [
    { id: 1, name: "Order Fulfillment", status: "running", progress: 75, eta: "2 hours" },
    { id: 2, name: "Quality Control", status: "pending", progress: 0, eta: "4 hours" },
    { id: 3, name: "Inventory Update", status: "running", progress: 92, eta: "30 minutes" },
    { id: 4, name: "Shipping Coordination", status: "completed", progress: 100, eta: "Complete" }
  ];

  const systemMetrics = [
    { name: "Production Line A", status: "operational", efficiency: 96 },
    { name: "Production Line B", status: "operational", efficiency: 91 },
    { name: "Quality Station", status: "maintenance", efficiency: 0 },
    { name: "Packaging Unit", status: "operational", efficiency: 88 }
  ];

  const recentAlerts = [
    { id: 1, message: "Inventory level low for Product SKU-001", severity: "warning", time: "10 min ago" },
    { id: 2, message: "Quality check passed for Batch #2024-09-23", severity: "success", time: "25 min ago" },
    { id: 3, message: "Scheduled maintenance for Line B at 6 PM", severity: "info", time: "1 hour ago" }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "operational": return "text-green-600";
      case "maintenance": return "text-yellow-600";
      case "running": return "text-blue-600";
      case "pending": return "text-orange-600";
      case "completed": return "text-green-600";
      default: return "text-gray-600";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "success": return "text-green-600 bg-green-50 border-green-200";
      case "warning": return "text-orange-600 bg-orange-50 border-orange-200";
      case "info": return "text-blue-600 bg-blue-50 border-blue-200";
      default: return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-purple-800 dark:text-purple-400" data-testid="operations-dashboard-title">
            Operations Dashboard
          </h1>
          <p className="text-muted-foreground">Monitor and optimize business operations in real-time</p>
          {user && <p className="text-sm text-muted-foreground">Operations Manager: {user.username}</p>}
        </div>
        <Badge variant="outline" className="text-green-600">
          <Activity className="w-4 h-4 mr-1" />
          {operationsStats.efficiencyRate}% Efficiency
        </Badge>
      </div>

      {/* Operations Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Processes</CardTitle>
            <Settings className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700" data-testid="active-processes">
              {operationsStats.activeProcesses}
            </div>
            <p className="text-xs text-muted-foreground">6 completed today</p>
          </CardContent>
        </Card>

        <Card className="border-green-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Uptime</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700" data-testid="system-uptime">
              {operationsStats.uptime}%
            </div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed Tasks</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700" data-testid="completed-tasks">
              {operationsStats.completedTasks}
            </div>
            <p className="text-xs text-muted-foreground">This week</p>
          </CardContent>
        </Card>

        <Card className="border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-700" data-testid="pending-approvals">
              {operationsStats.pendingApprovals}
            </div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Resource Utilization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2 text-purple-600" />
            Resource Utilization
          </CardTitle>
          <CardDescription>Current system and workforce capacity usage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Capacity Used</span>
              <span>{operationsStats.resourceUtilization}%</span>
            </div>
            <Progress value={operationsStats.resourceUtilization} className="h-3" />
            <p className="text-xs text-muted-foreground">
              Optimal range: 80-90% utilization
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Processes */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Settings className="w-5 h-5 mr-2 text-blue-600" />
              Active Processes
            </CardTitle>
            <CardDescription>Currently running operational workflows</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeProcesses.map((process) => (
                <div key={process.id} className="p-3 border rounded-lg" data-testid={`process-${process.id}`}>
                  <div className="flex justify-between items-center mb-2">
                    <p className="font-medium">{process.name}</p>
                    <Badge variant="outline" className={getStatusColor(process.status)}>
                      {process.status}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <Progress value={process.progress} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{process.progress}% complete</span>
                      <span>ETA: {process.eta}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Package className="w-5 h-5 mr-2 text-green-600" />
              System Status
            </CardTitle>
            <CardDescription>Production line and equipment status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {systemMetrics.map((system, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`system-${index}`}>
                  <div className="flex items-center space-x-3">
                    <div className={`w-3 h-3 rounded-full ${
                      system.status === 'operational' ? 'bg-green-500' : 
                      system.status === 'maintenance' ? 'bg-yellow-500' : 'bg-red-500'
                    }`}></div>
                    <div>
                      <p className="font-medium">{system.name}</p>
                      <p className={`text-sm capitalize ${getStatusColor(system.status)}`}>
                        {system.status}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-600">{system.efficiency}%</p>
                    <p className="text-xs text-muted-foreground">efficiency</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Alerts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertCircle className="w-5 h-5 mr-2 text-orange-600" />
            Recent Alerts
          </CardTitle>
          <CardDescription>Latest operational notifications and updates</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentAlerts.map((alert) => (
              <div key={alert.id} className={`p-3 border rounded-lg ${getSeverityColor(alert.severity)}`} data-testid={`alert-${alert.id}`}>
                <div className="flex justify-between items-start">
                  <p className="font-medium">{alert.message}</p>
                  <p className="text-xs text-muted-foreground">{alert.time}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Button className="bg-purple-600 hover:bg-purple-700" data-testid="button-process-management">
          <Settings className="w-4 h-4 mr-2" />
          Process Management
        </Button>
        <Button variant="outline" data-testid="button-resource-planning">
          <Package className="w-4 h-4 mr-2" />
          Resource Planning
        </Button>
        <Button variant="outline" data-testid="button-quality-control">
          <CheckCircle className="w-4 h-4 mr-2" />
          Quality Control
        </Button>
        <Button variant="outline" data-testid="button-maintenance-schedule">
          <Clock className="w-4 h-4 mr-2" />
          Maintenance Schedule
        </Button>
      </div>
    </div>
  );
}
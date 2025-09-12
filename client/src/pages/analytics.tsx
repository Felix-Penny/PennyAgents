import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, TrendingUp, TrendingDown, Activity, Shield, AlertTriangle, Users, Clock } from "lucide-react";

export default function Analytics() {
  const stats = {
    weeklyStats: {
      alertsGenerated: 42,
      alertsResolved: 38,
      incidentsPrevented: 15,
      falsePositives: 4,
      averageResponseTime: "3.2 minutes"
    },
    monthlyTrends: {
      alertsChange: 12, // percentage change
      incidentsChange: -8,
      responseTimeChange: -15
    }
  };

  const weeklyData = [
    { day: "Mon", alerts: 8, incidents: 3, prevented: 2 },
    { day: "Tue", alerts: 6, incidents: 1, prevented: 4 },
    { day: "Wed", alerts: 9, incidents: 2, prevented: 3 },
    { day: "Thu", alerts: 5, incidents: 0, prevented: 1 },
    { day: "Fri", alerts: 7, incidents: 1, prevented: 2 },
    { day: "Sat", alerts: 4, incidents: 0, prevented: 2 },
    { day: "Sun", alerts: 3, incidents: 1, prevented: 1 }
  ];

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Activity className="h-4 w-4 text-gray-600" />;
  };

  const getChangeColor = (change: number) => {
    if (change > 0) return "text-green-600";
    if (change < 0) return "text-red-600";
    return "text-gray-600";
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Security Analytics</h1>
          <p className="text-muted-foreground">Performance metrics and trend analysis</p>
        </div>
        <Badge variant="outline" className="text-green-600">
          <Activity className="w-4 h-4 mr-1" />
          System Operational
        </Badge>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card data-testid="card-alerts-generated">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alerts Generated</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.weeklyStats.alertsGenerated}</div>
            <div className={`text-xs flex items-center gap-1 ${getChangeColor(stats.monthlyTrends.alertsChange)}`}>
              {getChangeIcon(stats.monthlyTrends.alertsChange)}
              {Math.abs(stats.monthlyTrends.alertsChange)}% vs last month
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-alerts-resolved">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alerts Resolved</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.weeklyStats.alertsResolved}</div>
            <p className="text-xs text-muted-foreground">
              {Math.round((stats.weeklyStats.alertsResolved / stats.weeklyStats.alertsGenerated) * 100)}% resolution rate
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-incidents-prevented">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Incidents Prevented</CardTitle>
            <Shield className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.weeklyStats.incidentsPrevented}</div>
            <div className={`text-xs flex items-center gap-1 ${getChangeColor(stats.monthlyTrends.incidentsChange)}`}>
              {getChangeIcon(stats.monthlyTrends.incidentsChange)}
              {Math.abs(stats.monthlyTrends.incidentsChange)}% vs last month
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-false-positives">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">False Positives</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.weeklyStats.falsePositives}</div>
            <p className="text-xs text-muted-foreground">
              {Math.round((stats.weeklyStats.falsePositives / stats.weeklyStats.alertsGenerated) * 100)}% of total alerts
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-response-time">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.weeklyStats.averageResponseTime}</div>
            <div className={`text-xs flex items-center gap-1 ${getChangeColor(stats.monthlyTrends.responseTimeChange)}`}>
              {getChangeIcon(stats.monthlyTrends.responseTimeChange)}
              {Math.abs(stats.monthlyTrends.responseTimeChange)}% improvement
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="weekly" className="w-full">
        <TabsList>
          <TabsTrigger value="weekly">Weekly Overview</TabsTrigger>
          <TabsTrigger value="patterns">Alert Patterns</TabsTrigger>
          <TabsTrigger value="performance">System Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart className="h-5 w-5" />
                Weekly Activity Summary
              </CardTitle>
              <CardDescription>
                Daily breakdown of security alerts and incidents
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {weeklyData.map((day) => (
                  <div key={day.day} className="grid grid-cols-4 gap-4 p-3 rounded-lg bg-gray-50 dark:bg-gray-800" data-testid={`row-day-${day.day}`}>
                    <div className="font-medium">{day.day}</div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Alerts:</span> <span className="font-medium">{day.alerts}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Incidents:</span> <span className="font-medium text-red-600">{day.incidents}</span>
                    </div>
                    <div className="text-sm">
                      <span className="text-muted-foreground">Prevented:</span> <span className="font-medium text-green-600">{day.prevented}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-testid="card-time-patterns">
              <CardHeader>
                <CardTitle>Alert Time Patterns</CardTitle>
                <CardDescription>Most common alert times during the day</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>Peak Hours (2PM - 4PM)</span>
                  <Badge>35% of alerts</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Morning Rush (10AM - 12PM)</span>
                  <Badge variant="secondary">25% of alerts</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Evening (6PM - 8PM)</span>
                  <Badge variant="secondary">20% of alerts</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Off-Peak Hours</span>
                  <Badge variant="outline">20% of alerts</Badge>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-location-patterns">
              <CardHeader>
                <CardTitle>Location Hotspots</CardTitle>
                <CardDescription>Areas with highest alert frequency</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span>Electronics Section</span>
                  <Badge variant="destructive">High Activity</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Main Entrance</span>
                  <Badge className="bg-orange-100 text-orange-800">Medium Activity</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Pharmacy Area</span>
                  <Badge className="bg-orange-100 text-orange-800">Medium Activity</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Stockroom</span>
                  <Badge variant="secondary">Low Activity</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-testid="card-system-accuracy">
              <CardHeader>
                <CardTitle>Detection Accuracy</CardTitle>
                <CardDescription>AI system performance metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>True Positives</span>
                    <span className="font-medium">89.5%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-green-600 h-2 rounded-full" style={{ width: '89.5%' }}></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>False Positives</span>
                    <span className="font-medium">9.5%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '9.5%' }}></div>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Missed Detections</span>
                    <span className="font-medium">1%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-red-500 h-2 rounded-full" style={{ width: '1%' }}></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-system-health">
              <CardHeader>
                <CardTitle>System Health</CardTitle>
                <CardDescription>Infrastructure and connectivity status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Camera Uptime</span>
                  <Badge className="bg-green-100 text-green-800">99.2%</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>AI Processing Speed</span>
                  <Badge className="bg-green-100 text-green-800">1.2s avg</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Storage Usage</span>
                  <Badge variant="outline">67% capacity</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Network Latency</span>
                  <Badge className="bg-green-100 text-green-800">12ms avg</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
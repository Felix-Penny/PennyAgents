import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/use-websocket";
import { 
  BarChart, Bar, LineChart, Line, ResponsiveContainer, 
  XAxis, YAxis, CartesianGrid
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { 
  TrendingUp, TrendingDown, Activity, Shield, AlertTriangle, Target, 
  MapPin, Brain, RefreshCw, Calendar, Download
} from "lucide-react";
import { format, subDays } from "date-fns";
import ThreatHeatmap from "@/components/ThreatHeatmap";
import PerformanceMetrics from "@/components/PerformanceMetrics";
import IncidentTrends from "@/components/IncidentTrends";
import ReportsCenter from "@/components/ReportsCenter";
import BehavioralAnalytics from "@/components/behavioral/BehavioralAnalytics";
import BaselineChart from "@/components/behavioral/BaselineChart";
import AnomalyTimeline from "@/components/behavioral/AnomalyTimeline";
import BehavioralHeatmap from "@/components/behavioral/BehavioralHeatmap";
import PatternTrends from "@/components/behavioral/PatternTrends";

interface DateRange {
  from: Date;
  to: Date;
}

export default function Analytics() {
  const [selectedStore, setSelectedStore] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("daily");
  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 7),
    to: new Date()
  });

  // WebSocket connection for real-time updates
  const { isConnected, lastMessage } = useWebSocket("/analytics/realtime");

  // Main analytics dashboard query
  const { data: dashboardData, isLoading, refetch } = useQuery({
    queryKey: ['/api/analytics/dashboard', {
      storeId: selectedStore !== "all" ? selectedStore : undefined,
      period: selectedPeriod,
      startDate: dateRange.from.toISOString(),
      endDate: dateRange.to.toISOString()
    }],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Real-time status query
  const { data: realtimeStatus } = useQuery({
    queryKey: ['/api/analytics/realtime/status', { storeId: selectedStore !== "all" ? selectedStore : undefined }],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Effect for real-time updates
  useEffect(() => {
    if (lastMessage) {
      refetch();
    }
  }, [lastMessage, refetch]);

  const getChangeIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Activity className="h-4 w-4 text-gray-600" />;
  };

  const getThreatLevelColor = (level: string) => {
    switch (level) {
      case "critical": return "bg-red-100 text-red-800";
      case "high": return "bg-orange-100 text-orange-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      case "low": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const summary = dashboardData?.summary || {};
  const performance = dashboardData?.performance || {};
  const trends = dashboardData?.trends || {};
  const systemHealth = dashboardData?.systemHealth || {};

  return (
    <div className="p-6 space-y-6">
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3" data-testid="text-page-title">
            <Target className="h-8 w-8" />
            Security Analytics
          </h1>
          <p className="text-muted-foreground">
            Comprehensive security intelligence and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge 
            variant="outline" 
            className={isConnected ? "text-green-600 border-green-600" : "text-red-600 border-red-600"}
          >
            <Activity className="w-4 h-4 mr-1" />
            {isConnected ? "Live Updates" : "Offline"}
          </Badge>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            data-testid="button-refresh"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters and Controls */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedStore} onValueChange={setSelectedStore}>
            <SelectTrigger className="w-[180px]" data-testid="select-store">
              <SelectValue placeholder="Select Store" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stores</SelectItem>
              <SelectItem value="store-1">Downtown Store</SelectItem>
              <SelectItem value="store-2">Mall Location</SelectItem>
              <SelectItem value="store-3">Airport Branch</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[120px]" data-testid="select-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hourly">Hourly</SelectItem>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <DatePickerWithRange
          date={dateRange}
          onDateChange={(range) => range && setDateRange(range)}
        />

        <Button variant="outline" size="sm" data-testid="button-export">
          <Download className="h-4 w-4 mr-1" />
          Export Data
        </Button>
      </div>

      {/* Executive Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card data-testid="card-total-incidents">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalIncidents || 0}</div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>

        <Card data-testid="card-prevented-incidents">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prevented</CardTitle>
            <Shield className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary.preventedIncidents || 0}</div>
            <p className="text-xs text-muted-foreground">
              {summary.totalIncidents > 0 ? Math.round((summary.preventedIncidents / summary.totalIncidents) * 100) : 0}% prevention rate
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-active-alerts">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <Activity className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.activeAlerts || 0}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>

        <Card data-testid="card-system-efficiency">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Efficiency</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(summary.systemEfficiency || 0)}%</div>
            <p className="text-xs text-muted-foreground">Overall performance</p>
          </CardContent>
        </Card>

        <Card data-testid="card-cost-savings">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost Savings</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${Math.round(summary.costSavings || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>

        <Card data-testid="card-threat-level">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Threat Level</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <Badge className={getThreatLevelColor(summary.threatLevel)}>
              {(summary.threatLevel || "low").toUpperCase()}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">Current assessment</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Analytics Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="incidents">Incident Trends</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="spatial">Heatmap</TabsTrigger>
          <TabsTrigger value="behavioral">Behavioral</TabsTrigger>
          <TabsTrigger value="predictions">Predictions</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-testid="card-recent-activity">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {dashboardData?.recentActivity?.alerts?.slice(0, 5).map((alert: any) => (
                    <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="font-medium">{alert.type}</p>
                        <p className="text-sm text-muted-foreground">{alert.location}</p>
                      </div>
                      <Badge variant={alert.severity === "critical" ? "destructive" : "secondary"}>
                        {alert.severity}
                      </Badge>
                    </div>
                  )) || (
                    <p className="text-muted-foreground text-center py-8">No recent activity</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-system-health-overview">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  System Health
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Camera Status</span>
                    <div className="text-right">
                      <div className="font-medium">
                        {systemHealth.cameraStatus?.online || 0}/{systemHealth.cameraStatus?.total || 0}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {Math.round(systemHealth.uptime || 0)}% uptime
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart className="h-5 w-5" />
                Weekly Performance Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  incidents: { label: "Incidents", color: "#ef4444" },
                  prevented: { label: "Prevented", color: "#22c55e" }
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={trends.weeklyIncidents || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="#3b82f6" name="Incidents" />
                    <Bar dataKey="prevented" fill="#22c55e" name="Prevented" />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="incidents">
          <IncidentTrends 
            storeId={selectedStore !== "all" ? selectedStore : undefined}
            period={selectedPeriod}
            dateRange={dateRange}
          />
        </TabsContent>

        <TabsContent value="performance">
          <PerformanceMetrics 
            storeId={selectedStore !== "all" ? selectedStore : undefined}
            period={selectedPeriod}
            dateRange={dateRange}
          />
        </TabsContent>

        <TabsContent value="spatial">
          <ThreatHeatmap 
            storeId={selectedStore !== "all" ? selectedStore : undefined}
            period={selectedPeriod}
            dateRange={dateRange}
          />
        </TabsContent>

        <TabsContent value="behavioral" className="space-y-6">
          <BehavioralAnalytics 
            storeId={selectedStore !== "all" ? selectedStore : ""} 
            dateRange={dateRange}
          />
        </TabsContent>

        <TabsContent value="predictions" className="space-y-6">
          <Card data-testid="card-risk-predictions">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Risk Predictions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Predictive analytics will be displayed here</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <ReportsCenter 
            storeId={selectedStore !== "all" ? selectedStore : undefined}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, ResponsiveContainer, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ComposedChart
} from "recharts";
import { 
  TrendingUp, TrendingDown, Activity, AlertTriangle, Shield, Clock, 
  BarChart3, Calendar, Download, Filter
} from "lucide-react";
import { useState } from "react";

interface IncidentTrendsProps {
  storeId?: string;
  period?: string;
  dateRange?: { from: Date; to: Date };
}

export default function IncidentTrends({ storeId, period, dateRange }: IncidentTrendsProps) {
  const [selectedChart, setSelectedChart] = useState<string>("overview");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");

  const { data: trendsData, isLoading, refetch } = useQuery({
    queryKey: ['/api/analytics/incidents/trends', {
      storeId,
      period,
      startDate: dateRange?.from?.toISOString(),
      endDate: dateRange?.to?.toISOString()
    }]
  });

  const summary = trendsData?.summary || {};
  const weeklyTrends = trendsData?.weeklyTrends || [];
  const monthlyTrends = trendsData?.monthlyTrends || [];

  const getChangeIcon = (trend: string) => {
    switch (trend) {
      case 'increasing': return <TrendingUp className="h-4 w-4 text-red-600" />;
      case 'decreasing': return <TrendingDown className="h-4 w-4 text-green-600" />;
      default: return <Activity className="h-4 w-4 text-gray-600" />;
    }
  };

  const getChangeColor = (trend: string) => {
    switch (trend) {
      case 'increasing': return "text-red-600";
      case 'decreasing': return "text-green-600";
      default: return "text-gray-600";
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return { variant: "destructive" as const, className: "" };
      case 'high': return { variant: "default" as const, className: "bg-orange-100 text-orange-800" };
      case 'medium': return { variant: "secondary" as const, className: "" };
      case 'low': return { variant: "outline" as const, className: "" };
      default: return { variant: "outline" as const, className: "" };
    }
  };

  // Generate hourly distribution data
  const hourlyData = Array.from({ length: 24 }, (_, hour) => ({
    hour: `${hour.toString().padStart(2, '0')}:00`,
    incidents: Math.floor(Math.random() * 10) + 1,
    alerts: Math.floor(Math.random() * 15) + 2,
    resolved: Math.floor(Math.random() * 8) + 1
  }));

  // Severity distribution data
  const severityData = [
    { severity: 'Critical', count: summary.criticalIncidents || 2, color: '#dc2626' },
    { severity: 'High', count: summary.highIncidents || 8, color: '#ea580c' },
    { severity: 'Medium', count: summary.mediumIncidents || 15, color: '#ca8a04' },
    { severity: 'Low', count: summary.lowIncidents || 12, color: '#22c55e' }
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={selectedChart} onValueChange={setSelectedChart}>
            <SelectTrigger className="w-[180px]" data-testid="select-chart-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">Overview</SelectItem>
              <SelectItem value="hourly">Hourly Patterns</SelectItem>
              <SelectItem value="severity">By Severity</SelectItem>
              <SelectItem value="trends">Long-term Trends</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
            <SelectTrigger className="w-[140px]" data-testid="select-severity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Severities</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} data-testid="button-refresh-trends">
            <Activity className="h-4 w-4 mr-1" />
            Refresh
          </Button>
          <Button variant="outline" size="sm" data-testid="button-export-trends">
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card data-testid="card-total-incidents-trend">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalIncidents || 0}</div>
            <div className={`text-xs flex items-center gap-1 ${getChangeColor(summary.trends?.incidentTrend || 'stable')}`}>
              {getChangeIcon(summary.trends?.incidentTrend || 'stable')}
              {(summary.trends?.incidentTrend || 'stable').charAt(0).toUpperCase() + (summary.trends?.incidentTrend || 'stable').slice(1)}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-prevented-incidents-trend">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prevented</CardTitle>
            <Shield className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary.preventedIncidents || 0}</div>
            <p className="text-xs text-muted-foreground">
              {Math.round(((summary.preventedIncidents || 0) / (summary.totalIncidents || 1)) * 100)}% prevention rate
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-response-time-trend">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(summary.averageResponseTime || 0).toFixed(1)}m</div>
            <div className={`text-xs flex items-center gap-1 ${getChangeColor(summary.trends?.responseTimeTrend || 'stable')}`}>
              {getChangeIcon(summary.trends?.responseTimeTrend || 'stable')}
              {(summary.trends?.responseTimeTrend || 'stable')} trend
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-detection-accuracy-trend">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Detection Accuracy</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(summary.detectionAccuracy || 0)}%</div>
            <div className={`text-xs flex items-center gap-1 ${getChangeColor(summary.trends?.accuracyTrend || 'stable')}`}>
              {getChangeIcon(summary.trends?.accuracyTrend || 'stable')}
              {(summary.trends?.accuracyTrend || 'stable')} trend
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dynamic Chart Display */}
      <Card data-testid="card-main-trends-chart">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {selectedChart === 'overview' && 'Incident Overview'}
            {selectedChart === 'hourly' && 'Hourly Incident Patterns'}
            {selectedChart === 'severity' && 'Incidents by Severity'}
            {selectedChart === 'trends' && 'Long-term Trends'}
          </CardTitle>
          <CardDescription>
            {selectedChart === 'overview' && 'Weekly incident summary with prevention metrics'}
            {selectedChart === 'hourly' && '24-hour incident distribution patterns'}
            {selectedChart === 'severity' && 'Distribution of incidents by severity level'}
            {selectedChart === 'trends' && 'Multi-month trend analysis'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              incidents: { label: "Incidents", color: "#ef4444" },
              prevented: { label: "Prevented", color: "#22c55e" },
              alerts: { label: "Alerts", color: "#3b82f6" },
              resolved: { label: "Resolved", color: "#8b5cf6" },
              count: { label: "Count", color: "#f59e0b" }
            }}
            className="h-[400px]"
          >
            <ResponsiveContainer width="100%" height="100%">
              {selectedChart === 'overview' && (
                <ComposedChart data={weeklyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="#ef4444" name="Incidents" />
                  <Line type="monotone" dataKey="prevented" stroke="#22c55e" strokeWidth={3} name="Prevented" />
                </ComposedChart>
              )}
              
              {selectedChart === 'hourly' && (
                <AreaChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="incidents" stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.7} />
                  <Area type="monotone" dataKey="alerts" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.7} />
                  <Area type="monotone" dataKey="resolved" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.7} />
                </AreaChart>
              )}
              
              {selectedChart === 'severity' && (
                <BarChart data={severityData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="severity" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" fill="#f59e0b" />
                </BarChart>
              )}
              
              {selectedChart === 'trends' && (
                <LineChart data={monthlyTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="incidents" stroke="#ef4444" strokeWidth={2} />
                  <Line type="monotone" dataKey="alerts" stroke="#3b82f6" strokeWidth={2} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Detailed Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-incident-categories">
          <CardHeader>
            <CardTitle>Top Incident Categories</CardTitle>
            <CardDescription>Most common incident types requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(summary.topIncidentTypes || ['Shoplifting', 'Suspicious Activity', 'Unauthorized Access', 'Vandalism']).map((type: string, index: number) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    <span className="font-medium">{type}</span>
                  </div>
                  <Badge variant="secondary">
                    {Math.floor(Math.random() * 20) + 5} incidents
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-peak-activity">
          <CardHeader>
            <CardTitle>Peak Activity Periods</CardTitle>
            <CardDescription>Times and locations with highest incident rates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">Peak Hours</h4>
                <div className="flex flex-wrap gap-2">
                  {(summary.peakHours || [14, 16, 18]).map((hour: number) => (
                    <Badge key={hour} className="bg-red-100 text-red-800">
                      {hour}:00 - {hour + 1}:00
                    </Badge>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium mb-2">High-Activity Cameras</h4>
                <div className="space-y-2">
                  {(summary.topCameras || ['CAM-001', 'CAM-005', 'CAM-012']).map((camera: string, index: number) => (
                    <div key={camera} className="flex items-center justify-between">
                      <span className="text-sm">{camera}</span>
                      <Badge variant="outline">
                        {15 - index * 3} incidents
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Incident Resolution Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{summary.activeIncidents || 0}</div>
              <p className="text-sm text-muted-foreground">Active Incidents</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{summary.resolvedIncidents || 0}</div>
              <p className="text-sm text-muted-foreground">Resolved</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{summary.escalatedIncidents || 0}</div>
              <p className="text-sm text-muted-foreground">Escalated</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {Math.round((summary.aiDetections || 0) / ((summary.aiDetections || 0) + (summary.humanReports || 0)) * 100) || 0}%
              </div>
              <p className="text-sm text-muted-foreground">AI Detection Rate</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
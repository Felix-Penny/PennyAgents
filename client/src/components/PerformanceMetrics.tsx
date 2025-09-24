import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useQuery } from "@tanstack/react-query";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, ResponsiveContainer, 
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell
} from "recharts";
import { 
  Activity, Shield, Clock, Camera, Target, TrendingUp, TrendingDown, 
  CheckCircle, AlertCircle, Zap, Server, Wifi, HardDrive
} from "lucide-react";

interface PerformanceMetricsProps {
  storeId?: string;
  period?: string;
  dateRange?: { from: Date; to: Date };
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function PerformanceMetrics({ storeId, period, dateRange }: PerformanceMetricsProps) {
  const { data: performanceData, isLoading } = useQuery({
    queryKey: ['/api/analytics/performance', {
      storeId,
      period,
      startDate: dateRange?.from?.toISOString(),
      endDate: dateRange?.to?.toISOString()
    }]
  });

  const metrics = performanceData?.metrics || {};
  const systemHealth = performanceData?.systemHealth || {};

  const getPerformanceColor = (value: number, type: 'percentage' | 'time' = 'percentage') => {
    if (type === 'time') {
      // For response times, lower is better
      if (value <= 2) return "text-green-600";
      if (value <= 5) return "text-yellow-600";
      return "text-red-600";
    } else {
      // For percentages, higher is better
      if (value >= 90) return "text-green-600";
      if (value >= 70) return "text-yellow-600";
      return "text-red-600";
    }
  };

  const getStatusBadge = (value: number, type: 'percentage' | 'time' = 'percentage') => {
    if (type === 'time') {
      if (value <= 2) return { variant: "default", className: "bg-green-100 text-green-800" };
      if (value <= 5) return { variant: "secondary", className: "bg-yellow-100 text-yellow-800" };
      return { variant: "destructive", className: "" };
    } else {
      if (value >= 90) return { variant: "default", className: "bg-green-100 text-green-800" };
      if (value >= 70) return { variant: "secondary", className: "bg-yellow-100 text-yellow-800" };
      return { variant: "destructive", className: "" };
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
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

  // Mock data for charts if not available
  const responseTimeTrend = [
    { time: "00:00", responseTime: 2.1, alertVolume: 12 },
    { time: "04:00", responseTime: 1.8, alertVolume: 8 },
    { time: "08:00", responseTime: 2.4, alertVolume: 25 },
    { time: "12:00", responseTime: 3.1, alertVolume: 42 },
    { time: "16:00", responseTime: 2.8, alertVolume: 38 },
    { time: "20:00", responseTime: 2.2, alertVolume: 18 }
  ];

  const accuracyData = [
    { name: "True Positives", value: Math.round(metrics.detectionAccuracy || 85), color: "#22c55e" },
    { name: "False Positives", value: Math.round(metrics.falsePositiveRate || 12), color: "#ef4444" },
    { name: "Missed", value: 100 - Math.round(metrics.detectionAccuracy || 85) - Math.round(metrics.falsePositiveRate || 12), color: "#6b7280" }
  ];

  return (
    <div className="space-y-6">
      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card data-testid="card-detection-accuracy">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Detection Accuracy</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPerformanceColor(metrics.detectionAccuracy || 0)}`}>
              {Math.round(metrics.detectionAccuracy || 0)}%
            </div>
            <Progress value={metrics.detectionAccuracy || 0} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              AI detection performance
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-response-time">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPerformanceColor(metrics.averageResponseTime || 0, 'time')}`}>
              {(metrics.averageResponseTime || 0).toFixed(1)}m
            </div>
            <Badge {...getStatusBadge(metrics.averageResponseTime || 0, 'time')}>
              {metrics.averageResponseTime <= 2 ? "Excellent" : metrics.averageResponseTime <= 5 ? "Good" : "Needs Improvement"}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">
              Alert to action time
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-camera-uptime">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Camera Uptime</CardTitle>
            <Camera className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPerformanceColor(metrics.cameraUptime || 0)}`}>
              {Math.round(metrics.cameraUptime || 0)}%
            </div>
            <div className="flex items-center gap-2 mt-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm">{systemHealth.cameraStatus?.online || 0} online</span>
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="text-sm">{systemHealth.cameraStatus?.offline || 0} offline</span>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-alert-resolution">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getPerformanceColor(metrics.alertResolutionRate || 0)}`}>
              {Math.round(metrics.alertResolutionRate || 0)}%
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {metrics.acknowledgedAlerts || 0} of {metrics.totalAlerts || 0} alerts resolved
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-response-trends">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Response Time Trends
            </CardTitle>
            <CardDescription>24-hour response time and alert volume patterns</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                responseTime: { label: "Response Time (min)", color: "#3b82f6" },
                alertVolume: { label: "Alert Volume", color: "#ef4444" }
              }}
              className="h-[250px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={responseTimeTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="responseTime"
                    stroke="#3b82f6"
                    strokeWidth={2}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="alertVolume"
                    stroke="#ef4444"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card data-testid="card-accuracy-breakdown">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Detection Accuracy Breakdown
            </CardTitle>
            <CardDescription>Distribution of detection results</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                value: { label: "Percentage", color: "#3b82f6" }
              }}
              className="h-[250px]"
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={accuracyData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}%`}
                  >
                    {accuracyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* System Health Dashboard */}
      <Card data-testid="card-system-health">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            System Health Dashboard
          </CardTitle>
          <CardDescription>Real-time infrastructure and performance monitoring</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Processing Speed */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-600" />
                <span className="text-sm font-medium">Processing Speed</span>
              </div>
              <div className="text-2xl font-bold">{systemHealth.processingSpeed || 0}s</div>
              <Progress value={Math.max(0, 100 - (systemHealth.processingSpeed || 0) * 50)} />
              <p className="text-xs text-muted-foreground">Average processing time</p>
            </div>

            {/* Storage Usage */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium">Storage Usage</span>
              </div>
              <div className="text-2xl font-bold">{systemHealth.storageUsage || 0}%</div>
              <Progress value={systemHealth.storageUsage || 0} />
              <p className="text-xs text-muted-foreground">Disk capacity used</p>
            </div>

            {/* Network Latency */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Wifi className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">Network Latency</span>
              </div>
              <div className="text-2xl font-bold">{systemHealth.networkLatency || 0}ms</div>
              <Progress value={Math.max(0, 100 - (systemHealth.networkLatency || 0) * 5)} />
              <p className="text-xs text-muted-foreground">Average response time</p>
            </div>

            {/* System Uptime */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">System Uptime</span>
              </div>
              <div className="text-2xl font-bold">{Math.round(systemHealth.uptime || 0)}%</div>
              <Progress value={systemHealth.uptime || 0} />
              <p className="text-xs text-muted-foreground">Overall availability</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card data-testid="card-team-efficiency">
          <CardHeader>
            <CardTitle>Team Performance</CardTitle>
            <CardDescription>Security team efficiency metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>Alert Acknowledgment Time</span>
                <div className="text-right">
                  <div className="font-medium">{(metrics.avgAcknowledgmentTime || 0).toFixed(1)}m</div>
                  <div className={`text-sm ${getPerformanceColor(metrics.avgAcknowledgmentTime || 0, 'time')}`}>
                    {metrics.avgAcknowledgmentTime <= 2 ? "Excellent" : "Good"}
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span>Alert Escalation Rate</span>
                <div className="text-right">
                  <div className="font-medium">{Math.round((metrics.escalatedAlerts || 0) / (metrics.totalAlerts || 1) * 100)}%</div>
                  <div className="text-sm text-muted-foreground">
                    {metrics.escalatedAlerts || 0} escalated
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span>Coverage Effectiveness</span>
                <div className="text-right">
                  <div className="font-medium">{Math.round(metrics.coveragePercentage || 0)}%</div>
                  <div className="text-sm text-muted-foreground">
                    {metrics.activeCameras || 0}/{metrics.totalCameras || 0} cameras
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-quality-metrics">
          <CardHeader>
            <CardTitle>Quality Metrics</CardTitle>
            <CardDescription>Evidence and resolution quality indicators</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span>Evidence Quality Score</span>
                <div className="text-right">
                  <div className="font-medium">{Math.round(metrics.evidenceQualityScore || 0)}%</div>
                  <Badge {...getStatusBadge(metrics.evidenceQualityScore || 0)}>
                    {(metrics.evidenceQualityScore || 0) >= 90 ? "Excellent" : "Good"}
                  </Badge>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span>Prosecution Success Rate</span>
                <div className="text-right">
                  <div className="font-medium">{Math.round(metrics.prosecutionRate || 0)}%</div>
                  <div className="text-sm text-muted-foreground">
                    {metrics.successfulProsecutions || 0} successful cases
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span>False Positive Rate</span>
                <div className="text-right">
                  <div className={`font-medium ${getPerformanceColor(100 - (metrics.falsePositiveRate || 0))}`}>
                    {Math.round(metrics.falsePositiveRate || 0)}%
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Lower is better
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
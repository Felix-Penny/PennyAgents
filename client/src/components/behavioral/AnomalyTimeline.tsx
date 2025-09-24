/**
 * AnomalyTimeline - Real-time timeline visualization of behavioral anomalies
 * Shows chronological view of anomaly events with severity indicators and details
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Clock, AlertTriangle, MapPin, Activity, TrendingUp,
  Eye, Zap, Shield, Brain, ChevronDown, ChevronRight, ChevronUp
} from "lucide-react";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface AnomalyTimelineProps {
  storeId: string;
  dateRange: {
    from: Date;
    to: Date;
  };
  selectedArea: string;
  selectedEventType: string;
  anomalies: any[];
}

const chartConfig = {
  anomalies: {
    label: "Anomaly Count",
    color: "hsl(var(--destructive))",
  },
  severity: {
    label: "Avg Severity Score",
    color: "hsl(var(--warning))",
  }
};

export default function AnomalyTimeline({ 
  storeId, 
  dateRange, 
  selectedArea, 
  selectedEventType,
  anomalies 
}: AnomalyTimelineProps) {
  
  const [selectedSeverity, setSelectedSeverity] = useState<string>("all");
  const [expandedAnomaly, setExpandedAnomaly] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'timeline' | 'chart'>('timeline');

  // Filter anomalies based on selections
  const filteredAnomalies = anomalies.filter(anomaly => {
    const matchesArea = selectedArea === "all" || anomaly.area === selectedArea;
    const matchesSeverity = selectedSeverity === "all" || anomaly.severity === selectedSeverity;
    // Note: eventType filtering would need to be added to anomaly metadata
    return matchesArea && matchesSeverity;
  }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Get severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "bg-red-100 text-red-800 border-red-200";
      case "high": return "bg-orange-100 text-orange-800 border-orange-200";
      case "medium": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "low": return "bg-blue-100 text-blue-800 border-blue-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical": return <Zap className="h-4 w-4" />;
      case "high": return <AlertTriangle className="h-4 w-4" />;
      case "medium": return <Eye className="h-4 w-4" />;
      case "low": return <Activity className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  // Process data for chart visualization
  const processChartData = () => {
    const hourlyData = new Map();
    
    filteredAnomalies.forEach(anomaly => {
      const hour = format(parseISO(anomaly.timestamp), 'yyyy-MM-dd HH:00');
      if (!hourlyData.has(hour)) {
        hourlyData.set(hour, {
          time: format(parseISO(hour), 'MMM dd HH:mm'),
          count: 0,
          severitySum: 0,
          severities: []
        });
      }
      
      const data = hourlyData.get(hour);
      data.count += 1;
      data.severities.push(anomaly.severity);
      
      // Convert severity to numeric score for averaging
      const severityScore = ({
        critical: 4,
        high: 3,
        medium: 2,
        low: 1
      } as const)[anomaly.severity as 'critical' | 'high' | 'medium' | 'low'] || 1;
      
      data.severitySum += severityScore;
    });

    return Array.from(hourlyData.values()).map(data => ({
      ...data,
      avgSeverity: data.count > 0 ? data.severitySum / data.count : 0
    })).sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
  };

  const chartData = processChartData();

  // Calculate summary statistics
  const severityDistribution = filteredAnomalies.reduce((acc, anomaly) => {
    acc[anomaly.severity] = (acc[anomaly.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const avgDeviationScore = filteredAnomalies.reduce((sum, anomaly) => 
    sum + (anomaly.deviationScore || 0), 0) / (filteredAnomalies.length || 1);

  const recentAnomalies = filteredAnomalies.slice(0, 5);
  const timeSpan = filteredAnomalies.length > 1 ? 
    differenceInMinutes(
      parseISO(filteredAnomalies[0].timestamp), 
      parseISO(filteredAnomalies[filteredAnomalies.length - 1].timestamp)
    ) : 0;

  return (
    <div className="space-y-6">
      {/* Anomaly Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Anomalies</CardTitle>
            <Clock className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{filteredAnomalies.length}</div>
            <p className="text-xs text-muted-foreground">
              {timeSpan > 0 ? `Over ${Math.round(timeSpan / 60)} hours` : 'This period'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Events</CardTitle>
            <Zap className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {severityDistribution.critical || 0}
            </div>
            <p className="text-xs text-muted-foreground">Immediate attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Deviation</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {avgDeviationScore.toFixed(2)}σ
            </div>
            <p className="text-xs text-muted-foreground">From baseline</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <Activity className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {recentAnomalies.length}
            </div>
            <p className="text-xs text-muted-foreground">Last hour</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by severity" />
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
          <Button
            variant={viewMode === 'timeline' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('timeline')}
          >
            <Clock className="h-4 w-4 mr-1" />
            Timeline
          </Button>
          <Button
            variant={viewMode === 'chart' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('chart')}
          >
            <TrendingUp className="h-4 w-4 mr-1" />
            Chart
          </Button>
        </div>
      </div>

      {/* Chart View */}
      {viewMode === 'chart' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Anomaly Distribution Over Time
            </CardTitle>
            <CardDescription>
              Hourly anomaly counts and average severity levels
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <LineChart
                data={chartData}
                margin={{
                  top: 5,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="var(--color-anomalies)"
                  strokeWidth={2}
                  dot={{ fill: "var(--color-anomalies)", strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Anomaly Timeline
            </CardTitle>
            <CardDescription>
              Chronological view of behavioral anomalies with detailed information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[600px]">
              <div className="space-y-4">
                {filteredAnomalies.length === 0 ? (
                  <div className="text-center py-12">
                    <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No anomalies detected in this period</p>
                  </div>
                ) : (
                  filteredAnomalies.map((anomaly, index) => (
                    <div
                      key={anomaly.id}
                      className="relative pl-8 pb-6 last:pb-0"
                    >
                      {/* Timeline line */}
                      {index < filteredAnomalies.length - 1 && (
                        <div className="absolute left-4 top-8 w-px h-full bg-border" />
                      )}
                      
                      {/* Timeline dot */}
                      <div className={`absolute left-2 top-2 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        anomaly.severity === 'critical' ? 'bg-red-100 border-red-500' :
                        anomaly.severity === 'high' ? 'bg-orange-100 border-orange-500' :
                        anomaly.severity === 'medium' ? 'bg-yellow-100 border-yellow-500' :
                        'bg-blue-100 border-blue-500'
                      }`}>
                        <div className={`w-2 h-2 rounded-full ${
                          anomaly.severity === 'critical' ? 'bg-red-500' :
                          anomaly.severity === 'high' ? 'bg-orange-500' :
                          anomaly.severity === 'medium' ? 'bg-yellow-500' :
                          'bg-blue-500'
                        }`} />
                      </div>

                      {/* Anomaly Card */}
                      <div className="bg-card border rounded-lg p-4 ml-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge className={getSeverityColor(anomaly.severity)}>
                              {getSeverityIcon(anomaly.severity)}
                              {anomaly.severity.toUpperCase()}
                            </Badge>
                            <Badge variant="outline">
                              <MapPin className="h-3 w-3 mr-1" />
                              {anomaly.area?.replace(/_/g, ' ')}
                            </Badge>
                            <Badge variant="secondary">
                              {anomaly.deviationScore?.toFixed(2)}σ
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {format(parseISO(anomaly.timestamp), 'MMM dd, HH:mm:ss')}
                          </div>
                        </div>

                        <h4 className="font-medium mb-1">
                          {anomaly.description || 'Behavioral anomaly detected'}
                        </h4>
                        
                        <p className="text-sm text-muted-foreground mb-3">
                          Significant deviation from established behavioral baseline patterns
                        </p>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Deviation:</span>
                              <span className="ml-1 font-medium">
                                {anomaly.deviationScore?.toFixed(2)} standard deviations
                              </span>
                            </div>
                            {anomaly.area && (
                              <div>
                                <span className="text-muted-foreground">Location:</span>
                                <span className="ml-1 font-medium">
                                  {anomaly.area.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                                </span>
                              </div>
                            )}
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setExpandedAnomaly(
                              expandedAnomaly === anomaly.id ? null : anomaly.id
                            )}
                          >
                            {expandedAnomaly === anomaly.id ? (
                              <>
                                <ChevronUp className="h-4 w-4 mr-1" />
                                Less
                              </>
                            ) : (
                              <>
                                <ChevronDown className="h-4 w-4 mr-1" />
                                Details
                              </>
                            )}
                          </Button>
                        </div>

                        {/* Expanded Details */}
                        {expandedAnomaly === anomaly.id && (
                          <div className="mt-4 pt-4 border-t space-y-2">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Anomaly Type:</span>
                                <span className="ml-2 font-medium">
                                  {anomaly.anomalyType?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Statistical Outlier'}
                                </span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Alert Generated:</span>
                                <span className="ml-2">
                                  <Badge variant={anomaly.alertGenerated ? 'default' : 'secondary'}>
                                    {anomaly.alertGenerated ? 'Yes' : 'No'}
                                  </Badge>
                                </span>
                              </div>
                            </div>
                            
                            {anomaly.metadata && (
                              <div>
                                <span className="text-muted-foreground">Additional Info:</span>
                                <pre className="mt-1 text-xs bg-muted p-2 rounded overflow-x-auto">
                                  {JSON.stringify(anomaly.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
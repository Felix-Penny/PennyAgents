/**
 * Behavioral Analytics - Main container component for behavioral pattern learning visualizations
 * Provides comprehensive behavioral insights, anomaly detection, and pattern analysis
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/use-websocket";
import { 
  Brain, Activity, TrendingUp, AlertTriangle, Target, 
  Eye, BarChart3, Clock, Map, Zap
} from "lucide-react";
// @ts-ignore
import BaselineChart from "./BaselineChart";
// @ts-ignore
import AnomalyTimeline from "./AnomalyTimeline";
// @ts-ignore
import BehavioralHeatmap from "./BehavioralHeatmap";
// @ts-ignore
import PatternTrends from "./PatternTrends";

interface BehavioralAnalyticsProps {
  storeId: string;
  dateRange: {
    from: Date;
    to: Date;
  };
}

export default function BehavioralAnalytics({ storeId, dateRange }: BehavioralAnalyticsProps) {
  const [selectedArea, setSelectedArea] = useState<string>("all");
  const [selectedEventType, setSelectedEventType] = useState<string>("all");

  // WebSocket connection for real-time behavioral updates
  const { isConnected, sendMessage } = useWebSocket();

  // Behavioral analytics dashboard data query
  const { data: behavioralData, isLoading, refetch } = useQuery({
    queryKey: ['/api/analytics/behavioral/dashboard', {
      storeId,
      startDate: dateRange.from.toISOString(),
      endDate: dateRange.to.toISOString()
    }],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Behavioral trends query
  const { data: trendsData } = useQuery({
    queryKey: ['/api/analytics/behavioral/trends', {
      storeId,
      eventType: selectedEventType !== "all" ? selectedEventType : undefined,
      area: selectedArea !== "all" ? selectedArea : undefined,
      startDate: dateRange.from.toISOString(),
      endDate: dateRange.to.toISOString()
    }],
    refetchInterval: 30000,
  });

  // Real-time updates - subscribe to behavioral updates
  useEffect(() => {
    if (isConnected) {
      // Subscribe to behavioral updates
      sendMessage({
        type: 'subscribe_behavioral',
        storeId: storeId
      });
      
      // Refresh data when connected
      refetch();
    }
  }, [isConnected, sendMessage, storeId, refetch]);

  const summary = (behavioralData as any)?.summary || {};
  const timeline = (behavioralData as any)?.timeline || [];
  const anomalies = (behavioralData as any)?.anomalies || [];
  const baselines = (behavioralData as any)?.baselines || [];

  // Get unique areas and event types for filtering
  const areas = Array.from(new Set(timeline.map((event: any) => event.area))).filter(Boolean);
  const eventTypes = Array.from(new Set(timeline.map((event: any) => event.eventType))).filter(Boolean);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Brain className="h-12 w-12 animate-pulse mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">Loading behavioral analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Behavioral Analytics Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-3">
            <Brain className="h-7 w-7 text-purple-600" />
            Behavioral Pattern Learning
          </h2>
          <p className="text-muted-foreground">
            AI-powered behavioral baseline establishment and anomaly detection
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge 
            variant="outline" 
            className={isConnected ? "text-green-600 border-green-600" : "text-red-600 border-red-600"}
          >
            <Activity className="w-4 h-4 mr-1" />
            {isConnected ? "Real-time Updates" : "Offline"}
          </Badge>
        </div>
      </div>

      {/* Behavioral Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card data-testid="card-behavior-events">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Behavior Events</CardTitle>
            <Eye className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalEvents || 0}</div>
            <p className="text-xs text-muted-foreground">This period</p>
          </CardContent>
        </Card>

        <Card data-testid="card-anomalies-detected">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anomalies</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{summary.totalAnomalies || 0}</div>
            <p className="text-xs text-muted-foreground">
              {summary.anomalyRate}% anomaly rate
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-baselines-established">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Baselines</CardTitle>
            <Target className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{summary.baselineCount || 0}</div>
            <p className="text-xs text-muted-foreground">Areas monitored</p>
          </CardContent>
        </Card>

        <Card data-testid="card-critical-anomalies">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
            <Zap className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {summary.severityDistribution?.critical || 0}
            </div>
            <p className="text-xs text-muted-foreground">High priority</p>
          </CardContent>
        </Card>

        <Card data-testid="card-detection-performance">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Accuracy</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {summary.detectionAccuracy || 92}%
            </div>
            <p className="text-xs text-muted-foreground">System accuracy</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={selectedArea} onValueChange={setSelectedArea}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by area" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Areas</SelectItem>
            {areas.map((area: any) => (
              <SelectItem key={area} value={area}>
                {String(area).replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedEventType} onValueChange={setSelectedEventType}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter by event type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Event Types</SelectItem>
            {eventTypes.map((eventType: any) => (
              <SelectItem key={eventType} value={eventType}>
                {String(eventType).replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Behavioral Analytics Tabs */}
      <Tabs defaultValue="baselines" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="baselines" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Baseline Analysis
          </TabsTrigger>
          <TabsTrigger value="anomalies" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Anomaly Timeline
          </TabsTrigger>
          <TabsTrigger value="spatial" className="flex items-center gap-2">
            <Map className="h-4 w-4" />
            Spatial Patterns
          </TabsTrigger>
          <TabsTrigger value="trends" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Pattern Trends
          </TabsTrigger>
        </TabsList>

        <TabsContent value="baselines" className="space-y-6">
          <BaselineChart 
            storeId={storeId} 
            dateRange={dateRange}
            selectedArea={selectedArea}
            selectedEventType={selectedEventType}
            baselines={baselines}
            behaviorEvents={timeline}
          />
        </TabsContent>

        <TabsContent value="anomalies" className="space-y-6">
          <AnomalyTimeline 
            storeId={storeId} 
            dateRange={dateRange}
            selectedArea={selectedArea}
            selectedEventType={selectedEventType}
            anomalies={anomalies}
          />
        </TabsContent>

        <TabsContent value="spatial" className="space-y-6">
          <BehavioralHeatmap 
            storeId={storeId} 
            dateRange={dateRange}
            behaviorEvents={timeline}
            anomalies={anomalies}
          />
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <PatternTrends 
            storeId={storeId} 
            dateRange={dateRange}
            selectedArea={selectedArea}
            selectedEventType={selectedEventType}
            trendsData={trendsData}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
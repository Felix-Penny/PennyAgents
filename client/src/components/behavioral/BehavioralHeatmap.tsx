/**
 * BehavioralHeatmap - Spatial visualization of behavioral patterns and anomalies
 * Shows heat map of activity levels, anomaly hotspots, and area-based behavioral insights
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Map, Activity, AlertTriangle, TrendingUp, 
  Eye, MapPin, Thermometer, Grid3X3
} from "lucide-react";

interface BehavioralHeatmapProps {
  storeId: string;
  dateRange: {
    from: Date;
    to: Date;
  };
  behaviorEvents: any[];
  anomalies: any[];
}

interface HeatmapCell {
  area: string;
  eventCount: number;
  anomalyCount: number;
  averageConfidence: number;
  intensity: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  dominantEventType: string;
}

export default function BehavioralHeatmap({ 
  storeId, 
  dateRange, 
  behaviorEvents,
  anomalies 
}: BehavioralHeatmapProps) {
  
  const [selectedMetric, setSelectedMetric] = useState<'events' | 'anomalies' | 'risk'>('events');
  const [selectedEventType, setSelectedEventType] = useState<string>("all");

  // Process data for heatmap visualization
  const processHeatmapData = (): HeatmapCell[] => {
    const areaData = new Map<string, {
      events: any[];
      anomalies: any[];
      eventTypes: Record<string, number>;
    }>();

    // Group behavior events by area
    behaviorEvents
      .filter(event => selectedEventType === "all" || event.eventType === selectedEventType)
      .forEach(event => {
        const area = event.area || 'unknown';
        if (!areaData.has(area)) {
          areaData.set(area, { events: [], anomalies: [], eventTypes: {} });
        }
        const data = areaData.get(area)!;
        data.events.push(event);
        data.eventTypes[event.eventType] = (data.eventTypes[event.eventType] || 0) + 1;
      });

    // Group anomalies by area
    anomalies.forEach(anomaly => {
      const area = anomaly.area || 'unknown';
      if (!areaData.has(area)) {
        areaData.set(area, { events: [], anomalies: [], eventTypes: {} });
      }
      areaData.get(area)!.anomalies.push(anomaly);
    });

    // Create heatmap cells
    const cells: HeatmapCell[] = [];
    const allEventCounts = Array.from(areaData.values()).map(data => data.events.length);
    const maxEventCount = Math.max(...allEventCounts, 1);
    const allAnomalyCounts = Array.from(areaData.values()).map(data => data.anomalies.length);
    const maxAnomalyCount = Math.max(...allAnomalyCounts, 1);

    areaData.forEach((data, area) => {
      const eventCount = data.events.length;
      const anomalyCount = data.anomalies.length;
      const averageConfidence = eventCount > 0 
        ? data.events.reduce((sum, e) => sum + e.confidence, 0) / eventCount 
        : 0;

      // Calculate intensity based on selected metric
      let intensity = 0;
      if (selectedMetric === 'events') {
        intensity = eventCount / maxEventCount;
      } else if (selectedMetric === 'anomalies') {
        intensity = anomalyCount / maxAnomalyCount;
      } else {
        // Risk calculation: weighted combination of events, anomalies, and confidence
        const eventRisk = eventCount / maxEventCount;
        const anomalyRisk = anomalyCount / maxAnomalyCount;
        const confidenceRisk = 1 - averageConfidence; // Lower confidence = higher risk
        intensity = (eventRisk * 0.4 + anomalyRisk * 0.5 + confidenceRisk * 0.1);
      }

      // Determine risk level
      let riskLevel: 'low' | 'medium' | 'high' | 'critical';
      if (anomalyCount > 5 || intensity > 0.8) riskLevel = 'critical';
      else if (anomalyCount > 2 || intensity > 0.6) riskLevel = 'high';
      else if (anomalyCount > 0 || intensity > 0.3) riskLevel = 'medium';
      else riskLevel = 'low';

      // Find dominant event type
      const dominantEventType = Object.entries(data.eventTypes)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'none';

      cells.push({
        area,
        eventCount,
        anomalyCount,
        averageConfidence,
        intensity,
        riskLevel,
        dominantEventType
      });
    });

    return cells.sort((a, b) => b.intensity - a.intensity);
  };

  const heatmapData = processHeatmapData();
  const eventTypes = [...new Set(behaviorEvents.map(e => e.eventType))];

  // Get color for intensity
  const getIntensityColor = (intensity: number, metric: string) => {
    const alpha = Math.max(0.1, intensity);
    if (metric === 'events') {
      return `rgba(59, 130, 246, ${alpha})`; // Blue
    } else if (metric === 'anomalies') {
      return `rgba(239, 68, 68, ${alpha})`; // Red
    } else {
      return `rgba(168, 85, 247, ${alpha})`; // Purple for risk
    }
  };

  const getRiskBadgeColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Calculate summary statistics
  const totalAreas = heatmapData.length;
  const highRiskAreas = heatmapData.filter(cell => cell.riskLevel === 'critical' || cell.riskLevel === 'high').length;
  const totalEvents = heatmapData.reduce((sum, cell) => sum + cell.eventCount, 0);
  const totalAnomalies = heatmapData.reduce((sum, cell) => sum + cell.anomalyCount, 0);

  return (
    <div className="space-y-6">
      {/* Heatmap Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Areas Monitored</CardTitle>
            <Grid3X3 className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAreas}</div>
            <p className="text-xs text-muted-foreground">Active monitoring zones</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Risk Areas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{highRiskAreas}</div>
            <p className="text-xs text-muted-foreground">
              {totalAreas > 0 ? Math.round((highRiskAreas / totalAreas) * 100) : 0}% of areas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Activity</CardTitle>
            <Activity className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalEvents}</div>
            <p className="text-xs text-muted-foreground">Behavioral events</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anomaly Hotspots</CardTitle>
            <Thermometer className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{totalAnomalies}</div>
            <p className="text-xs text-muted-foreground">Total anomalies</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Select value={selectedMetric} onValueChange={(value: any) => setSelectedMetric(value)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select metric" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="events">Event Activity</SelectItem>
              <SelectItem value="anomalies">Anomaly Count</SelectItem>
              <SelectItem value="risk">Risk Level</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedEventType} onValueChange={setSelectedEventType}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Filter by event type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Event Types</SelectItem>
              {eventTypes.map((eventType: string) => (
                <SelectItem key={eventType} value={eventType}>
                  {eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground">Intensity:</div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded border" style={{ 
              backgroundColor: getIntensityColor(0.2, selectedMetric) 
            }} />
            <span className="text-xs">Low</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded border" style={{ 
              backgroundColor: getIntensityColor(0.6, selectedMetric) 
            }} />
            <span className="text-xs">Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded border" style={{ 
              backgroundColor: getIntensityColor(1.0, selectedMetric) 
            }} />
            <span className="text-xs">High</span>
          </div>
        </div>
      </div>

      {/* Spatial Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Map className="h-5 w-5" />
            Behavioral Pattern Heatmap
          </CardTitle>
          <CardDescription>
            Spatial visualization of behavioral activity, anomalies, and risk levels across monitored areas.
            {selectedMetric === 'events' && ' Showing event activity intensity.'}
            {selectedMetric === 'anomalies' && ' Showing anomaly concentration.'}
            {selectedMetric === 'risk' && ' Showing overall risk assessment.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {heatmapData.length === 0 ? (
            <div className="text-center py-12">
              <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No behavioral data available for visualization</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {heatmapData.map((cell, index) => (
                <div
                  key={cell.area}
                  className="relative p-4 rounded-lg border transition-all hover:shadow-md cursor-pointer"
                  style={{
                    backgroundColor: getIntensityColor(cell.intensity, selectedMetric)
                  }}
                >
                  {/* Area Header */}
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-semibold text-sm">
                      {cell.area.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </h4>
                    <Badge className={getRiskBadgeColor(cell.riskLevel)}>
                      {cell.riskLevel}
                    </Badge>
                  </div>

                  {/* Metrics */}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Events:</span>
                      <span className="font-medium">{cell.eventCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Anomalies:</span>
                      <span className="font-medium text-orange-600">{cell.anomalyCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Confidence:</span>
                      <span className="font-medium">{Math.round(cell.averageConfidence * 100)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Primary:</span>
                      <span className="font-medium text-xs">
                        {cell.dominantEventType.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>

                  {/* Intensity indicator */}
                  <div className="absolute top-2 right-2">
                    <div className="w-3 h-3 rounded-full border-2 border-white shadow-sm" style={{
                      backgroundColor: getIntensityColor(1.0, selectedMetric)
                    }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Risk Areas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Areas of Interest
          </CardTitle>
          <CardDescription>
            Areas with highest activity or risk levels requiring attention
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {heatmapData.slice(0, 10).map((cell, index) => (
              <div key={cell.area} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium">
                      {cell.area.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Primary: {cell.dominantEventType.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <Badge className={getRiskBadgeColor(cell.riskLevel)}>
                    {cell.riskLevel}
                  </Badge>
                  <div className="text-sm text-muted-foreground mt-1">
                    {cell.eventCount} events, {cell.anomalyCount} anomalies
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
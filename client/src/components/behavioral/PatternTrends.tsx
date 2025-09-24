/**
 * PatternTrends - Advanced trend analysis for behavioral patterns
 * Shows temporal patterns, seasonal variations, and predictive insights for behavioral events
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, ComposedChart,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, ReferenceLine
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { 
  TrendingUp, TrendingDown, Activity, Calendar, Clock, 
  BarChart3, Zap, Target, Brain, Lightbulb
} from "lucide-react";
import { format, parseISO, startOfHour, startOfDay, startOfWeek } from "date-fns";

interface PatternTrendsProps {
  storeId: string;
  dateRange: {
    from: Date;
    to: Date;
  };
  selectedArea: string;
  selectedEventType: string;
  trendsData: any;
}

const chartConfig = {
  events: {
    label: "Event Count",
    color: "hsl(var(--chart-1))",
  },
  confidence: {
    label: "Avg Confidence",
    color: "hsl(var(--chart-2))",
  },
  prediction: {
    label: "Predicted",
    color: "hsl(var(--chart-3))",
  },
  anomalies: {
    label: "Anomalies",
    color: "hsl(var(--destructive))",
  }
};

export default function PatternTrends({ 
  storeId, 
  dateRange, 
  selectedArea, 
  selectedEventType,
  trendsData 
}: PatternTrendsProps) {
  
  const [viewMode, setViewMode] = useState<'temporal' | 'seasonal' | 'predictive'>('temporal');
  const [granularity, setGranularity] = useState<'hourly' | 'daily' | 'weekly'>('daily');

  const trends = trendsData?.trends || [];
  const summary = trendsData?.summary || {};

  // Process trends data for different visualizations
  const processTemporalData = () => {
    return trends.map((trend: any) => ({
      period: trend.period,
      eventCount: trend.eventCount,
      averageConfidence: Math.round(trend.averageConfidence * 100),
      eventTypes: trend.eventTypes?.length || 0,
      areas: trend.areas?.length || 0,
      // Simulate anomaly count based on event patterns
      anomalies: Math.max(0, trend.eventCount > (summary.totalEvents / trends.length * 1.5) ? 
        Math.floor(trend.eventCount * 0.1) : 0)
    }));
  };

  const processSeasonalData = () => {
    // Group data by hour of day, day of week, etc.
    const hourlyPatterns = new Array(24).fill(0).map((_, hour) => ({
      hour: `${hour}:00`,
      hourNum: hour,
      eventCount: 0,
      confidence: 0,
      samples: 0
    }));

    const weeklyPatterns = new Array(7).fill(0).map((_, day) => ({
      day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day],
      dayNum: day,
      eventCount: 0,
      confidence: 0,
      samples: 0
    }));

    // Process trends to extract seasonal patterns
    trends.forEach((trend: any) => {
      const date = parseISO(trend.period + 'T00:00:00Z');
      const hour = date.getHours();
      const dayOfWeek = date.getDay();

      // Update hourly patterns
      if (hourlyPatterns[hour]) {
        hourlyPatterns[hour].eventCount += trend.eventCount;
        hourlyPatterns[hour].confidence += trend.averageConfidence;
        hourlyPatterns[hour].samples += 1;
      }

      // Update weekly patterns
      if (weeklyPatterns[dayOfWeek]) {
        weeklyPatterns[dayOfWeek].eventCount += trend.eventCount;
        weeklyPatterns[dayOfWeek].confidence += trend.averageConfidence;
        weeklyPatterns[dayOfWeek].samples += 1;
      }
    });

    // Calculate averages
    hourlyPatterns.forEach(pattern => {
      if (pattern.samples > 0) {
        pattern.confidence = Math.round((pattern.confidence / pattern.samples) * 100);
      }
    });

    weeklyPatterns.forEach(pattern => {
      if (pattern.samples > 0) {
        pattern.confidence = Math.round((pattern.confidence / pattern.samples) * 100);
      }
    });

    return { hourlyPatterns, weeklyPatterns };
  };

  const processPredictiveData = () => {
    const temporalData = processTemporalData();
    
    // Simple moving average prediction for next few periods
    const predictionPeriods = 5;
    const windowSize = Math.min(5, temporalData.length);
    
    const predictions = [];
    for (let i = 0; i < predictionPeriods; i++) {
      // Calculate moving average for prediction
      const recentData = temporalData.slice(-windowSize);
      const avgEvents = recentData.reduce((sum, d) => sum + d.eventCount, 0) / windowSize;
      const avgConfidence = recentData.reduce((sum, d) => sum + d.averageConfidence, 0) / windowSize;
      
      // Add some trend adjustment
      const trend = windowSize > 1 ? 
        (recentData[windowSize - 1].eventCount - recentData[0].eventCount) / (windowSize - 1) : 0;
      
      const predictedEvents = Math.max(0, Math.round(avgEvents + (trend * (i + 1))));
      
      predictions.push({
        period: `Future +${i + 1}`,
        predictedEvents,
        predictedConfidence: Math.round(avgConfidence),
        confidence: Math.max(0.3, 0.9 - (i * 0.1)), // Decreasing confidence for further predictions
        type: 'prediction'
      });
    }

    return [...temporalData.map(d => ({ ...d, type: 'actual' })), ...predictions];
  };

  const temporalData = processTemporalData();
  const { hourlyPatterns, weeklyPatterns } = processSeasonalData();
  const predictiveData = processPredictiveData();

  // Calculate trend direction
  const getTrendDirection = () => {
    if (temporalData.length < 2) return 'stable';
    const first = temporalData.slice(0, Math.floor(temporalData.length / 2))
      .reduce((sum, d) => sum + d.eventCount, 0);
    const second = temporalData.slice(Math.floor(temporalData.length / 2))
      .reduce((sum, d) => sum + d.eventCount, 0);
    
    const change = ((second - first) / (first || 1)) * 100;
    if (change > 10) return 'increasing';
    if (change < -10) return 'decreasing';
    return 'stable';
  };

  const trendDirection = getTrendDirection();
  const peakHour = hourlyPatterns.reduce((max, pattern) => 
    pattern.eventCount > max.eventCount ? pattern : max, hourlyPatterns[0]);
  const peakDay = weeklyPatterns.reduce((max, pattern) => 
    pattern.eventCount > max.eventCount ? pattern : max, weeklyPatterns[0]);

  return (
    <div className="space-y-6">
      {/* Pattern Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Trend</CardTitle>
            {trendDirection === 'increasing' ? <TrendingUp className="h-4 w-4 text-green-600" /> :
             trendDirection === 'decreasing' ? <TrendingDown className="h-4 w-4 text-red-600" /> :
             <Activity className="h-4 w-4 text-blue-600" />}
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant={
                trendDirection === 'increasing' ? 'default' :
                trendDirection === 'decreasing' ? 'destructive' : 'secondary'
              }>
                {trendDirection}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {trends.length} data points
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peak Activity</CardTitle>
            <Clock className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{peakHour?.hour || 'N/A'}</div>
            <p className="text-xs text-muted-foreground">
              {peakHour?.eventCount || 0} avg events
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Peak Day</CardTitle>
            <Calendar className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{peakDay?.day || 'N/A'}</div>
            <p className="text-xs text-muted-foreground">
              {peakDay?.eventCount || 0} total events
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pattern Complexity</CardTitle>
            <Brain className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-indigo-600">
              {Object.keys(summary.mostCommonEventType || {}).length}
            </div>
            <p className="text-xs text-muted-foreground">Event types detected</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'temporal' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('temporal')}
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              Temporal
            </Button>
            <Button
              variant={viewMode === 'seasonal' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('seasonal')}
            >
              <Calendar className="h-4 w-4 mr-1" />
              Seasonal
            </Button>
            <Button
              variant={viewMode === 'predictive' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('predictive')}
            >
              <Lightbulb className="h-4 w-4 mr-1" />
              Predictive
            </Button>
          </div>
        </div>
      </div>

      {/* Temporal Trends */}
      {viewMode === 'temporal' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Behavioral Pattern Timeline
            </CardTitle>
            <CardDescription>
              Event counts and confidence levels over time with anomaly indicators
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[400px]">
              <ComposedChart
                data={temporalData}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="period" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  yAxisId="events"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: 'Events', angle: -90, position: 'insideLeft' }}
                />
                <YAxis 
                  yAxisId="confidence"
                  orientation="right"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  label={{ value: 'Confidence %', angle: 90, position: 'insideRight' }}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                
                <Bar
                  yAxisId="events"
                  dataKey="eventCount"
                  fill="var(--color-events)"
                  radius={[2, 2, 0, 0]}
                />
                
                <Line
                  yAxisId="confidence"
                  type="monotone"
                  dataKey="averageConfidence"
                  stroke="var(--color-confidence)"
                  strokeWidth={2}
                  dot={{ fill: "var(--color-confidence)", strokeWidth: 2 }}
                />
                
                <Bar
                  yAxisId="events"
                  dataKey="anomalies"
                  fill="var(--color-anomalies)"
                  radius={[2, 2, 0, 0]}
                />
              </ComposedChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Seasonal Patterns */}
      {viewMode === 'seasonal' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Hourly Patterns
              </CardTitle>
              <CardDescription>
                Activity distribution throughout the day
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px]">
                <AreaChart
                  data={hourlyPatterns}
                  margin={{
                    top: 10,
                    right: 30,
                    left: 0,
                    bottom: 0,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="hour" 
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
                  <Area
                    type="monotone"
                    dataKey="eventCount"
                    stroke="var(--color-events)"
                    fill="var(--color-events)"
                    fillOpacity={0.6}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Weekly Patterns
              </CardTitle>
              <CardDescription>
                Activity distribution across days of the week
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={chartConfig} className="h-[300px]">
                <BarChart
                  data={weeklyPatterns}
                  margin={{
                    top: 10,
                    right: 30,
                    left: 0,
                    bottom: 0,
                  }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="day" 
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
                  <Bar
                    dataKey="eventCount"
                    fill="var(--color-events)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Predictive Analysis */}
      {viewMode === 'predictive' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Predictive Behavioral Analysis
            </CardTitle>
            <CardDescription>
              Historical data with predictive forecasting based on trend analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[400px]">
              <LineChart
                data={predictiveData}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 5,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="period" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip 
                  content={<ChartTooltipContent />}
                  formatter={(value, name, props) => [
                    value,
                    props.payload?.type === 'prediction' ? `Predicted ${name}` : name
                  ]}
                />
                
                <Line
                  type="monotone"
                  dataKey="eventCount"
                  stroke="var(--color-events)"
                  strokeWidth={2}
                  dot={{ fill: "var(--color-events)" }}
                  connectNulls={false}
                />
                
                <Line
                  type="monotone"
                  dataKey="predictedEvents"
                  stroke="var(--color-prediction)"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: "var(--color-prediction)" }}
                  connectNulls={false}
                />
                
                <ReferenceLine 
                  x={temporalData.length > 0 ? temporalData[temporalData.length - 1].period : ""} 
                  stroke="var(--border)" 
                  strokeDasharray="3 3" 
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Pattern Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Pattern Insights & Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3">Key Observations</h4>
              <div className="space-y-2">
                <div className="flex items-start gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                  <div>
                    <div className="font-medium">Peak Activity: {peakHour?.hour}</div>
                    <div className="text-muted-foreground">Highest event concentration during this hour</div>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-2" />
                  <div>
                    <div className="font-medium">Confidence: {Math.round(summary.averageConfidence * 100 || 0)}%</div>
                    <div className="text-muted-foreground">Average detection confidence across all events</div>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-purple-500 mt-2" />
                  <div>
                    <div className="font-medium">Trend: {trendDirection}</div>
                    <div className="text-muted-foreground">Overall pattern direction over time</div>
                  </div>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-3">Recommendations</h4>
              <div className="space-y-2">
                {peakHour && (
                  <div className="flex items-start gap-2 text-sm">
                    <Zap className="w-4 h-4 text-orange-500 mt-0.5" />
                    <div>
                      <div className="font-medium">Optimize Coverage</div>
                      <div className="text-muted-foreground">
                        Increase monitoring during peak hours ({peakHour.hour})
                      </div>
                    </div>
                  </div>
                )}
                {trendDirection === 'increasing' && (
                  <div className="flex items-start gap-2 text-sm">
                    <TrendingUp className="w-4 h-4 text-green-500 mt-0.5" />
                    <div>
                      <div className="font-medium">Resource Scaling</div>
                      <div className="text-muted-foreground">
                        Consider scaling detection resources due to increasing trend
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2 text-sm">
                  <Brain className="w-4 h-4 text-purple-500 mt-0.5" />
                  <div>
                    <div className="font-medium">Baseline Tuning</div>
                    <div className="text-muted-foreground">
                      Review and update baselines based on seasonal patterns
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
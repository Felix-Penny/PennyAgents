/**
 * BaselineChart - Visualizes behavioral baselines vs actual events
 * Shows statistical baseline profiles with confidence intervals and anomaly indicators
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  LineChart, Line, AreaChart, Area, ComposedChart, Bar,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, ReferenceLine
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { TrendingUp, Target, AlertTriangle, Info } from "lucide-react";
import { format, parseISO } from "date-fns";

interface BaselineChartProps {
  storeId: string;
  dateRange: {
    from: Date;
    to: Date;
  };
  selectedArea: string;
  selectedEventType: string;
  baselines: any[];
  behaviorEvents: any[];
}

const chartConfig = {
  baseline: {
    label: "Baseline",
    color: "hsl(var(--chart-2))",
  },
  actual: {
    label: "Actual Events",
    color: "hsl(var(--chart-1))",
  },
  upperBound: {
    label: "Upper Bound (3σ)",
    color: "hsl(var(--destructive))",
  },
  lowerBound: {
    label: "Lower Bound",
    color: "hsl(var(--muted-foreground))",
  },
  confidence: {
    label: "Confidence Interval",
    color: "hsl(var(--muted))",
  }
};

export default function BaselineChart({ 
  storeId, 
  dateRange, 
  selectedArea, 
  selectedEventType,
  baselines,
  behaviorEvents 
}: BaselineChartProps) {

  // Process data for visualization
  const processChartData = () => {
    // Group behavior events by hour for aggregation
    const eventsByHour = behaviorEvents.reduce((acc, event) => {
      const hour = format(parseISO(event.timestamp), 'yyyy-MM-dd HH:00');
      const key = `${hour}|${event.area}|${event.eventType}`;
      
      if (!acc[key]) {
        acc[key] = {
          timestamp: hour,
          area: event.area,
          eventType: event.eventType,
          count: 0,
          totalConfidence: 0
        };
      }
      
      acc[key].count += 1;
      acc[key].totalConfidence += event.confidence;
      
      return acc;
    }, {} as Record<string, any>);

    // Convert to array and calculate averages
    const aggregatedEvents = Object.values(eventsByHour).map((group: any) => ({
      ...group,
      averageConfidence: group.totalConfidence / group.count
    }));

    // Create time-based chart data
    const chartData = [];
    const startTime = new Date(dateRange.from);
    const endTime = new Date(dateRange.to);
    const hoursDiff = Math.ceil((endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60));

    for (let i = 0; i <= hoursDiff; i += 2) { // 2-hour intervals for clarity
      const currentTime = new Date(startTime.getTime() + (i * 60 * 60 * 1000));
      const timeKey = format(currentTime, 'yyyy-MM-dd HH:00');
      const hour = currentTime.getHours();
      
      // Find matching baseline for this hour
      const matchingBaseline = baselines.find(b => 
        (selectedArea === "all" || b.area === selectedArea) &&
        (selectedEventType === "all" || b.eventType === selectedEventType) &&
        (b.timeWindow.includes(`hour_${hour}`) || b.timeWindow === 'all_hours')
      );

      // Find actual events for this time
      const matchingEvents = aggregatedEvents.filter(e => 
        e.timestamp === timeKey &&
        (selectedArea === "all" || e.area === selectedArea) &&
        (selectedEventType === "all" || e.eventType === selectedEventType)
      );

      const actualCount = matchingEvents.reduce((sum, e) => sum + e.count, 0);
      const baselineValue = matchingBaseline?.meanValue || 0;
      const standardDeviation = matchingBaseline?.standardDeviation || 0;

      chartData.push({
        time: format(currentTime, 'MMM dd HH:mm'),
        baseline: baselineValue,
        actual: actualCount,
        upperBound: baselineValue + (3 * standardDeviation), // 3-sigma upper bound
        lowerBound: Math.max(0, baselineValue - (3 * standardDeviation)), // 3-sigma lower bound
        confidence: standardDeviation * 2, // 2-sigma confidence interval
        isAnomaly: actualCount > (baselineValue + (2.5 * standardDeviation)), // 2.5-sigma anomaly threshold
        deviationScore: standardDeviation > 0 ? Math.abs(actualCount - baselineValue) / standardDeviation : 0
      });
    }

    return chartData;
  };

  const chartData = processChartData();
  const anomalousPoints = chartData.filter(point => point.isAnomaly);
  const avgDeviation = chartData.reduce((sum, point) => sum + point.deviationScore, 0) / chartData.length;

  // Calculate baseline quality metrics
  const validBaselines = baselines.filter(b => 
    (selectedArea === "all" || b.area === selectedArea) &&
    (selectedEventType === "all" || b.eventType === selectedEventType)
  );

  const avgSampleSize = validBaselines.reduce((sum, b) => sum + (b.sampleCount || 0), 0) / (validBaselines.length || 1);
  const baselineQuality = avgSampleSize > 50 ? 'excellent' : avgSampleSize > 20 ? 'good' : avgSampleSize > 10 ? 'fair' : 'poor';

  return (
    <div className="space-y-6">
      {/* Baseline Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Baseline Quality</CardTitle>
            <Target className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant={baselineQuality === 'excellent' ? 'default' : 
                             baselineQuality === 'good' ? 'secondary' : 
                             baselineQuality === 'fair' ? 'outline' : 'destructive'}>
                {baselineQuality}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round(avgSampleSize)} avg samples
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Anomalies Detected</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{anomalousPoints.length}</div>
            <p className="text-xs text-muted-foreground">
              {((anomalousPoints.length / chartData.length) * 100).toFixed(1)}% of time periods
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Deviation</CardTitle>
            <TrendingUp className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{avgDeviation.toFixed(2)}σ</div>
            <p className="text-xs text-muted-foreground">Standard deviations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Baselines</CardTitle>
            <Info className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{validBaselines.length}</div>
            <p className="text-xs text-muted-foreground">Areas monitored</p>
          </CardContent>
        </Card>
      </div>

      {/* Baseline vs Actual Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Behavioral Baseline Analysis
          </CardTitle>
          <CardDescription>
            Comparison of expected behavioral patterns (baselines) with actual observed behavior.
            Anomalies are highlighted where actual behavior deviates significantly from established baselines.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[400px]">
            <ComposedChart
              data={chartData}
              margin={{
                top: 20,
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
                label={{ value: 'Event Count', angle: -90, position: 'insideLeft' }}
              />
              <ChartTooltip 
                content={<ChartTooltipContent />}
                formatter={(value, name) => [
                  name === 'deviationScore' ? `${Number(value).toFixed(2)}σ` : value,
                  name === 'baseline' ? 'Expected (Baseline)' :
                  name === 'actual' ? 'Observed Events' :
                  name === 'upperBound' ? 'Anomaly Threshold' :
                  name === 'confidence' ? 'Confidence Interval' :
                  name === 'deviationScore' ? 'Deviation Score' : name
                ]}
              />
              
              {/* Confidence interval area */}
              <Area
                type="monotone"
                dataKey="confidence"
                stroke="none"
                fill="var(--color-confidence)"
                fillOpacity={0.1}
                stackId="1"
              />
              
              {/* Baseline line */}
              <Line
                type="monotone"
                dataKey="baseline"
                stroke="var(--color-baseline)"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
              />
              
              {/* Actual events bar chart */}
              <Bar
                dataKey="actual"
                fill="var(--color-actual)"
                radius={[2, 2, 0, 0]}
              />
              
              {/* Anomaly threshold line */}
              <Line
                type="monotone"
                dataKey="upperBound"
                stroke="var(--color-upperBound)"
                strokeWidth={1}
                strokeDasharray="3 3"
                dot={false}
              />
            </ComposedChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Baseline Quality Details */}
      {validBaselines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Baseline Profiles</CardTitle>
            <CardDescription>
              Statistical profiles for different areas and event types
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {validBaselines.slice(0, 10).map((baseline, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">
                      {baseline.area?.replace(/_/g, ' ')}
                    </Badge>
                    <span className="text-sm font-medium">
                      {baseline.eventType?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {baseline.timeWindow}
                    </Badge>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-medium">μ={baseline.meanValue?.toFixed(2)} σ={baseline.standardDeviation?.toFixed(2)}</div>
                    <div className="text-muted-foreground">{baseline.sampleCount} samples</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
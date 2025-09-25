import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from "recharts";
import { 
  TrendingUp, TrendingDown, AlertTriangle, Shield, Users, Calendar,
  Activity, Target, BarChart3, Clock, CheckCircle, XCircle,
  Brain, Lightbulb, Settings, RefreshCw, Download, Filter
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { apiRequest } from "@/lib/queryClient";

// Types for predictive analytics
interface RiskAssessment {
  id: string;
  storeId: string;
  overallRiskScore: number;
  riskLevel: 'very_low' | 'low' | 'medium' | 'high' | 'critical';
  contributingFactors: {
    historicalIncidents: number;
    timeOfDay: number;
    dayOfWeek: number;
    seasonalPattern: number;
    staffingLevel: number;
    recentTrends: number;
  };
  confidence: number;
  recommendations: Array<{
    type: string;
    priority: string;
    description: string;
    estimatedImpact: number;
    implementationCost: string;
    timeframe: string;
  }>;
  nextReviewDate: string;
}

interface SeasonalAnalysis {
  id: string;
  timespan: string;
  patterns: {
    seasonal: Array<{
      period: string;
      incidentRate: number;
      commonIncidentTypes: string[];
      peakTimes: string[];
      riskFactors: string[];
      mitigationStrategies: string[];
    }>;
    weekly: Array<{
      dayOfWeek: string;
      averageIncidents: number;
      peakHours: string[];
    }>;
    daily: Array<{
      hour: number;
      incidentCount: number;
      riskLevel: string;
    }>;
  };
  predictions: {
    nextPeakPeriod: string;
    expectedIncidentIncrease: number;
    recommendedPreparations: string[];
  };
  confidence: number;
  dataQuality: string;
}

interface StaffingRecommendation {
  id: string;
  storeId: string;
  timeframeStart: string;
  timeframeEnd: string;
  currentStaffing: Array<{
    timeSlot: string;
    dayOfWeek: string;
    currentOfficers: number;
    skillLevels: string[];
  }>;
  recommendedStaffing: Array<{
    timeSlot: string;
    dayOfWeek: string;
    recommendedOfficers: number;
    skillRequirements: string[];
    priorityAreas: string[];
  }>;
  optimizationRationale: {
    predictedIncidentVolume: number;
    historicalWorkload: number;
    seasonalAdjustments: number;
    costEfficiencyScore: number;
  };
  expectedOutcomes: {
    incidentReductionPercent: number;
    responseTimeImprovement: number;
    costSavings: number;
    staffSatisfactionImpact: number;
  };
}

interface IncidentForecast {
  id: string;
  storeId: string;
  forecastPeriodStart: string;
  forecastPeriodEnd: string;
  predictedIncidents: Array<{
    date: string;
    predictedCount: number;
    incidentType: string;
    severity: string;
    confidence: number;
  }>;
  confidenceIntervals: {
    lower: number[];
    upper: number[];
    mean: number[];
  };
  modelAccuracy: number;
  recommendations: string[];
}

interface ModelPerformance {
  id: string;
  modelName: string;
  modelVersion: string;
  accuracyMetrics: {
    accuracy: number;
    precision: number;
    recall: number;
    f1Score: number;
    meanAbsoluteError: number;
  };
  performanceBenchmarks: {
    trainingTime: number;
    predictionLatency: number;
    memoryUsage: number;
    throughput: number;
  };
  deploymentStatus: string;
}

const RISK_LEVEL_COLORS = {
  very_low: '#22c55e',
  low: '#84cc16',
  medium: '#eab308',
  high: '#f97316',
  critical: '#ef4444'
};

const RISK_LEVEL_NAMES = {
  very_low: 'Very Low',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical'
};

export default function PredictiveAnalyticsDashboard() {
  const [selectedStore, setSelectedStore] = useState<string>("store-1");
  const [selectedTimeframe, setSelectedTimeframe] = useState<string>("7d");
  const [activeTab, setActiveTab] = useState<string>("risk-assessment");
  const queryClient = useQueryClient();

  // Risk Assessment Data
  const { data: riskAssessment, isLoading: riskLoading } = useQuery<RiskAssessment>({
    queryKey: ["/api/predictive/risk-assessment", selectedStore, selectedTimeframe],
    enabled: !!selectedStore
  });

  // Seasonal Analysis Data
  const { data: seasonalAnalysis, isLoading: seasonalLoading } = useQuery<SeasonalAnalysis>({
    queryKey: ["/api/predictive/seasonal-analysis", selectedTimeframe],
  });

  // Staffing Recommendations Data
  const { data: staffingRecommendations, isLoading: staffingLoading } = useQuery<StaffingRecommendation>({
    queryKey: ["/api/predictive/staffing-optimization", selectedStore],
    enabled: !!selectedStore
  });

  // Incident Forecasting Data
  const { data: incidentForecasts, isLoading: forecastLoading } = useQuery<IncidentForecast>({
    queryKey: ["/api/predictive/incident-forecast", selectedStore],
    enabled: !!selectedStore
  });

  // Model Performance Data
  const { data: modelPerformance, isLoading: modelLoading } = useQuery<ModelPerformance[]>({
    queryKey: ["/api/predictive/model-performance"],
  });

  // Mutation for generating new predictions
  const generatePredictions = useMutation({
    mutationFn: (data: { storeId: string; modelType: string }) => 
      apiRequest("POST", `/api/predictive/retrain-models`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/predictive"] });
    }
  });

  const RiskAssessmentTab = () => (
    <div className="space-y-6" data-testid="tab-risk-assessment">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overall Risk Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-risk-score">
              {riskAssessment?.overallRiskScore?.toFixed(1) || '0.0'}
            </div>
            <Badge 
              variant="outline" 
              style={{ color: RISK_LEVEL_COLORS[riskAssessment?.riskLevel || 'low'] }}
              data-testid="badge-risk-level"
            >
              {RISK_LEVEL_NAMES[riskAssessment?.riskLevel || 'low']}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Confidence Level</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-confidence">
              {((riskAssessment?.confidence ?? 0) * 100).toFixed(1)}%
            </div>
            <Progress value={(riskAssessment?.confidence ?? 0) * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recommendations</CardTitle>
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-recommendations-count">
              {riskAssessment?.recommendations?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Active suggestions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Review</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold" data-testid="text-next-review">
              {riskAssessment?.nextReviewDate ? 
                new Date(riskAssessment.nextReviewDate).toLocaleDateString() : 
                'Not scheduled'
              }
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Contributing Risk Factors</CardTitle>
            <CardDescription>Breakdown of factors influencing the risk score</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {riskAssessment?.contributingFactors && Object.entries(riskAssessment.contributingFactors).map(([factor, value]) => (
                <div key={factor} className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">
                    {factor.replace(/([A-Z])/g, ' $1').toLowerCase()}
                  </span>
                  <div className="flex items-center space-x-2">
                    <Progress value={value * 100} className="w-20" />
                    <span className="text-sm text-muted-foreground">
                      {(value * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Risk Mitigation Recommendations</CardTitle>
            <CardDescription>Actionable steps to reduce security risks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3" data-testid="list-recommendations">
              {riskAssessment?.recommendations?.map((rec, index) => (
                <Alert key={index}>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle className="flex items-center justify-between">
                    <span>{rec.type.charAt(0).toUpperCase() + rec.type.slice(1)}</span>
                    <Badge variant={rec.priority === 'urgent' ? 'destructive' : 'secondary'}>
                      {rec.priority}
                    </Badge>
                  </AlertTitle>
                  <AlertDescription>
                    <p className="mb-2">{rec.description}</p>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>Impact: {rec.estimatedImpact}% reduction</span>
                      <span>Cost: {rec.implementationCost}</span>
                      <span>Timeline: {rec.timeframe}</span>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const SeasonalAnalysisTab = () => (
    <div className="space-y-6" data-testid="tab-seasonal-analysis">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Quality</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-data-quality">
              {seasonalAnalysis?.dataQuality || 'Good'}
            </div>
            <Badge variant="outline" className="mt-1">
              Analysis Confidence: {((seasonalAnalysis?.confidence ?? 0) * 100).toFixed(1)}%
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Peak Period</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold" data-testid="text-next-peak">
              {seasonalAnalysis?.predictions?.nextPeakPeriod || 'Unknown'}
            </div>
            <p className="text-xs text-muted-foreground">
              Expected increase: +{seasonalAnalysis?.predictions?.expectedIncidentIncrease || 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Seasonal Patterns</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-patterns-count">
              {seasonalAnalysis?.patterns?.seasonal?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Identified patterns</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Incident Patterns</CardTitle>
            <CardDescription>Average incidents by day of week</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={seasonalAnalysis?.patterns?.weekly || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="dayOfWeek" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="averageIncidents" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily Risk Distribution</CardTitle>
            <CardDescription>Risk levels throughout the day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={seasonalAnalysis?.patterns?.daily || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="incidentCount" stroke="#ef4444" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Seasonal Risk Factors & Mitigation Strategies</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {seasonalAnalysis?.patterns?.seasonal?.map((pattern, index) => (
              <Card key={index} className="p-4">
                <h4 className="font-semibold mb-2 capitalize">{pattern.period}</h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium">Risk Level:</span> {pattern.incidentRate.toFixed(1)}%
                  </div>
                  <div>
                    <span className="font-medium">Common Types:</span>
                    <ul className="list-disc list-inside mt-1">
                      {pattern.commonIncidentTypes?.slice(0, 3).map((type, i) => (
                        <li key={i} className="text-xs">{type}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="font-medium">Mitigation:</span>
                    <ul className="list-disc list-inside mt-1">
                      {pattern.mitigationStrategies?.slice(0, 2).map((strategy, i) => (
                        <li key={i} className="text-xs">{strategy}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const StaffingOptimizationTab = () => (
    <div className="space-y-6" data-testid="tab-staffing-optimization">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Incident Reduction</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-incident-reduction">
              {staffingRecommendations?.expectedOutcomes?.incidentReductionPercent || 0}%
            </div>
            <p className="text-xs text-muted-foreground">Expected reduction</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600" data-testid="text-response-improvement">
              {staffingRecommendations?.expectedOutcomes?.responseTimeImprovement || 0}%
            </div>
            <p className="text-xs text-muted-foreground">Improvement</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cost Savings</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-cost-savings">
              ${staffingRecommendations?.expectedOutcomes?.costSavings?.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground">Annual savings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Staff Satisfaction</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-staff-satisfaction">
              {(staffingRecommendations?.expectedOutcomes?.staffSatisfactionImpact ?? 0) > 0 ? '+' : ''}
              {staffingRecommendations?.expectedOutcomes?.staffSatisfactionImpact ?? 0}%
            </div>
            <p className="text-xs text-muted-foreground">Impact on satisfaction</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Current vs Recommended Staffing</CardTitle>
            <CardDescription>Comparison of current and optimized staffing levels</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {staffingRecommendations?.currentStaffing?.map((current, index) => {
                const recommended = staffingRecommendations.recommendedStaffing[index];
                return (
                  <div key={index} className="border rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">{current.timeSlot}</span>
                      <span className="text-sm text-muted-foreground">{current.dayOfWeek}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-muted-foreground">Current</span>
                        <div className="text-lg font-bold">{current.currentOfficers} officers</div>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Recommended</span>
                        <div className="text-lg font-bold text-blue-600">
                          {recommended?.recommendedOfficers || 0} officers
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Optimization Rationale</CardTitle>
            <CardDescription>Factors driving staffing recommendations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Predicted Incident Volume</span>
                <div className="flex items-center space-x-2">
                  <Progress 
                    value={staffingRecommendations?.optimizationRationale?.predictedIncidentVolume || 0} 
                    className="w-20" 
                  />
                  <span className="text-sm text-muted-foreground">
                    {staffingRecommendations?.optimizationRationale?.predictedIncidentVolume || 0}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Historical Workload</span>
                <div className="flex items-center space-x-2">
                  <Progress 
                    value={staffingRecommendations?.optimizationRationale?.historicalWorkload || 0} 
                    className="w-20" 
                  />
                  <span className="text-sm text-muted-foreground">
                    {staffingRecommendations?.optimizationRationale?.historicalWorkload || 0}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Seasonal Adjustments</span>
                <div className="flex items-center space-x-2">
                  <Progress 
                    value={staffingRecommendations?.optimizationRationale?.seasonalAdjustments || 0} 
                    className="w-20" 
                  />
                  <span className="text-sm text-muted-foreground">
                    {staffingRecommendations?.optimizationRationale?.seasonalAdjustments || 0}%
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Cost Efficiency Score</span>
                <div className="flex items-center space-x-2">
                  <Progress 
                    value={staffingRecommendations?.optimizationRationale?.costEfficiencyScore || 0} 
                    className="w-20" 
                  />
                  <span className="text-sm text-muted-foreground">
                    {(staffingRecommendations?.optimizationRationale?.costEfficiencyScore || 0).toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const IncidentForecastingTab = () => (
    <div className="space-y-6" data-testid="tab-incident-forecasting">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Model Accuracy</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600" data-testid="text-model-accuracy">
              {((incidentForecasts?.modelAccuracy ?? 0) * 100).toFixed(1)}%
            </div>
            <Progress value={(incidentForecasts?.modelAccuracy ?? 0) * 100} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Forecast Period</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold" data-testid="text-forecast-period">
              {incidentForecasts?.forecastPeriodStart && incidentForecasts?.forecastPeriodEnd ? 
                `${new Date(incidentForecasts.forecastPeriodStart).toLocaleDateString()} - ${new Date(incidentForecasts.forecastPeriodEnd).toLocaleDateString()}` :
                'No active forecast'
              }
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Predicted Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-predicted-incidents">
              {incidentForecasts?.predictedIncidents?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">Next 7 days</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Incident Forecast with Confidence Intervals</CardTitle>
          <CardDescription>Predicted incidents over time with uncertainty bounds</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={incidentForecasts?.predictedIncidents || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="predictedCount" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Predicted Incidents"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Forecast by Incident Type</CardTitle>
            <CardDescription>Breakdown of predicted incidents by category</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={incidentForecasts?.predictedIncidents?.reduce((acc: any[], curr) => {
                    const existing = acc.find(item => item.name === curr.incidentType);
                    if (existing) {
                      existing.value += curr.predictedCount;
                    } else {
                      acc.push({ name: curr.incidentType, value: curr.predictedCount });
                    }
                    return acc;
                  }, []) || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {incidentForecasts?.predictedIncidents?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 50%)`} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Forecast Recommendations</CardTitle>
            <CardDescription>Actionable insights from prediction analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3" data-testid="list-forecast-recommendations">
              {incidentForecasts?.recommendations?.map((recommendation, index) => (
                <Alert key={index}>
                  <Lightbulb className="h-4 w-4" />
                  <AlertDescription>{recommendation}</AlertDescription>
                </Alert>
              ))}
              {(!incidentForecasts?.recommendations || incidentForecasts.recommendations.length === 0) && (
                <p className="text-muted-foreground text-sm">No recommendations available. Generate a new forecast to see insights.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const ModelPerformanceTab = () => (
    <div className="space-y-6" data-testid="tab-model-performance">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {modelPerformance?.map((model, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{model.modelName}</CardTitle>
              <Brain className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600" data-testid={`text-model-accuracy-${index}`}>
                {(model.accuracyMetrics?.accuracy * 100)?.toFixed(1) || '0.0'}%
              </div>
              <Badge 
                variant={model.deploymentStatus === 'production' ? 'default' : 'secondary'}
                className="mt-1"
              >
                {model.deploymentStatus}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Model Accuracy Metrics</CardTitle>
            <CardDescription>Performance metrics across all prediction models</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={modelPerformance || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="modelName" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="accuracyMetrics.accuracy" fill="#3b82f6" name="Accuracy" />
                <Bar dataKey="accuracyMetrics.precision" fill="#10b981" name="Precision" />
                <Bar dataKey="accuracyMetrics.recall" fill="#f59e0b" name="Recall" />
                <Bar dataKey="accuracyMetrics.f1Score" fill="#ef4444" name="F1 Score" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Performance Benchmarks</CardTitle>
            <CardDescription>Operational metrics for model deployment</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {modelPerformance?.map((model, index) => (
                <div key={index} className="border rounded-lg p-3">
                  <h4 className="font-semibold mb-2">{model.modelName}</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Training Time:</span>
                      <div className="font-medium">{model.performanceBenchmarks?.trainingTime}s</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Prediction Latency:</span>
                      <div className="font-medium">{model.performanceBenchmarks?.predictionLatency}ms</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Memory Usage:</span>
                      <div className="font-medium">{model.performanceBenchmarks?.memoryUsage}MB</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Throughput:</span>
                      <div className="font-medium">{model.performanceBenchmarks?.throughput}/s</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Model Management</CardTitle>
          <CardDescription>Actions for model training and deployment</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button
              onClick={() => generatePredictions.mutate({ storeId: selectedStore, modelType: 'risk_scoring' })}
              disabled={generatePredictions.isPending}
              data-testid="button-retrain-risk"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retrain Risk Model
            </Button>
            <Button
              onClick={() => generatePredictions.mutate({ storeId: selectedStore, modelType: 'seasonal_analysis' })}
              disabled={generatePredictions.isPending}
              data-testid="button-retrain-seasonal"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retrain Seasonal Model
            </Button>
            <Button
              onClick={() => generatePredictions.mutate({ storeId: selectedStore, modelType: 'staffing_optimization' })}
              disabled={generatePredictions.isPending}
              data-testid="button-retrain-staffing"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retrain Staffing Model
            </Button>
            <Button
              onClick={() => generatePredictions.mutate({ storeId: selectedStore, modelType: 'incident_forecasting' })}
              disabled={generatePredictions.isPending}
              data-testid="button-retrain-forecasting"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retrain Forecast Model
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Predictive Analytics Dashboard
          </h1>
          <p className="text-muted-foreground">
            Intelligent risk scoring, seasonal analysis, and staffing optimization powered by machine learning
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <Select value={selectedStore} onValueChange={setSelectedStore}>
            <SelectTrigger className="w-48" data-testid="select-store">
              <SelectValue placeholder="Select store" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="store-1">Store 1 - Downtown</SelectItem>
              <SelectItem value="store-2">Store 2 - Mall</SelectItem>
              <SelectItem value="store-3">Store 3 - Airport</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={selectedTimeframe} onValueChange={setSelectedTimeframe}>
            <SelectTrigger className="w-40" data-testid="select-timeframe">
              <SelectValue placeholder="Timeframe" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1d">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5" data-testid="tabs-list">
          <TabsTrigger value="risk-assessment" data-testid="tab-trigger-risk">Risk Assessment</TabsTrigger>
          <TabsTrigger value="seasonal-analysis" data-testid="tab-trigger-seasonal">Seasonal Analysis</TabsTrigger>
          <TabsTrigger value="staffing-optimization" data-testid="tab-trigger-staffing">Staffing Optimization</TabsTrigger>
          <TabsTrigger value="incident-forecasting" data-testid="tab-trigger-forecasting">Incident Forecasting</TabsTrigger>
          <TabsTrigger value="model-performance" data-testid="tab-trigger-performance">Model Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="risk-assessment" className="mt-6">
          {riskLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <RiskAssessmentTab />
          )}
        </TabsContent>

        <TabsContent value="seasonal-analysis" className="mt-6">
          {seasonalLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <SeasonalAnalysisTab />
          )}
        </TabsContent>

        <TabsContent value="staffing-optimization" className="mt-6">
          {staffingLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <StaffingOptimizationTab />
          )}
        </TabsContent>

        <TabsContent value="incident-forecasting" className="mt-6">
          {forecastLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <IncidentForecastingTab />
          )}
        </TabsContent>

        <TabsContent value="model-performance" className="mt-6">
          {modelLoading ? (
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <ModelPerformanceTab />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
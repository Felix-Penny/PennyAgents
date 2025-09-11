import { Layout } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Shield, AlertTriangle, DollarSign, Clock, Target, Users } from "lucide-react";
import { useState } from "react";

export default function Analytics() {
  const [timeRange, setTimeRange] = useState('7d');
  
  const { data: stats } = useQuery({
    queryKey: ['/api/incidents/stats'],
    queryFn: () => fetch('/api/incidents/stats?storeId=store-1').then(res => res.json())
  });

  const { data: preventionRate } = useQuery({
    queryKey: ['/api/analytics/prevention-rate'],
    queryFn: () => fetch('/api/analytics/prevention-rate?storeId=store-1').then(res => res.json())
  });

  const { data: detectionAccuracy } = useQuery({
    queryKey: ['/api/analytics/detection-accuracy'],
    queryFn: () => fetch('/api/analytics/detection-accuracy?storeId=store-1').then(res => res.json())
  });

  // Mock data for charts (in real app, this would come from API)
  const incidentTrends = [
    { date: '2024-01-01', incidents: 12, prevented: 9 },
    { date: '2024-01-02', incidents: 8, prevented: 7 },
    { date: '2024-01-03', incidents: 15, prevented: 12 },
    { date: '2024-01-04', incidents: 6, prevented: 6 },
    { date: '2024-01-05', incidents: 11, prevented: 8 },
    { date: '2024-01-06', incidents: 9, prevented: 8 },
    { date: '2024-01-07', incidents: 7, prevented: 7 },
  ];

  const detectionMethods = [
    { name: 'Object Detection', value: 45, color: '#3b82f6' },
    { name: 'Gait Analysis', value: 25, color: '#10b981' },
    { name: 'Behavior Pattern', value: 20, color: '#f59e0b' },
    { name: 'Facial Recognition', value: 10, color: '#ef4444' },
  ];

  const performanceMetrics = [
    { metric: 'Theft Detection', current: 96.8, target: 95, trend: 2.3 },
    { metric: 'False Positive Rate', current: 2.1, target: 5, trend: -0.8 },
    { metric: 'Response Time', current: 4.2, target: 6, trend: -1.1 },
    { metric: 'Prevention Rate', current: preventionRate?.rate || 94, target: 90, trend: 3.2 },
  ];

  const hourlyActivity = [
    { hour: '00', incidents: 1 }, { hour: '01', incidents: 0 }, { hour: '02', incidents: 1 },
    { hour: '03', incidents: 0 }, { hour: '04', incidents: 0 }, { hour: '05', incidents: 2 },
    { hour: '06', incidents: 3 }, { hour: '07', incidents: 5 }, { hour: '08', incidents: 8 },
    { hour: '09', incidents: 12 }, { hour: '10', incidents: 15 }, { hour: '11', incidents: 18 },
    { hour: '12', incidents: 22 }, { hour: '13', incidents: 20 }, { hour: '14', incidents: 25 },
    { hour: '15', incidents: 28 }, { hour: '16', incidents: 24 }, { hour: '17', incidents: 30 },
    { hour: '18', incidents: 32 }, { hour: '19', incidents: 28 }, { hour: '20', incidents: 22 },
    { hour: '21', incidents: 15 }, { hour: '22', incidents: 8 }, { hour: '23', incidents: 4 },
  ];

  return (
    <Layout>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Security Analytics"
          subtitle="Comprehensive performance insights and trend analysis"
          alertCount={0}
          networkStatus="active"
        />

        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Time Range Selector */}
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-semibold">Performance Dashboard</h2>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-40" data-testid="select-time-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 Hours</SelectItem>
                <SelectItem value="7d">Last 7 Days</SelectItem>
                <SelectItem value="30d">Last 30 Days</SelectItem>
                <SelectItem value="90d">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Key Performance Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {performanceMetrics.map((metric) => (
              <Card key={metric.metric}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{metric.metric}</p>
                      <p className="text-2xl font-bold">
                        {metric.metric.includes('Time') ? `${metric.current}s` : `${metric.current}%`}
                      </p>
                    </div>
                    {metric.metric === 'Theft Detection' && <Shield className="h-8 w-8 text-primary" />}
                    {metric.metric === 'False Positive Rate' && <AlertTriangle className="h-8 w-8 text-yellow-500" />}
                    {metric.metric === 'Response Time' && <Clock className="h-8 w-8 text-blue-500" />}
                    {metric.metric === 'Prevention Rate' && <Target className="h-8 w-8 text-green-500" />}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {metric.trend > 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <span className={`text-sm ${metric.trend > 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {Math.abs(metric.trend)}% vs target
                    </span>
                  </div>
                  <Progress 
                    value={Math.min((metric.current / metric.target) * 100, 100)} 
                    className="mt-2"
                  />
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Analytics Tabs */}
          <Tabs defaultValue="incidents" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="incidents" data-testid="tab-incidents">Incident Trends</TabsTrigger>
              <TabsTrigger value="detection" data-testid="tab-detection">Detection Methods</TabsTrigger>
              <TabsTrigger value="patterns" data-testid="tab-patterns">Activity Patterns</TabsTrigger>
              <TabsTrigger value="network" data-testid="tab-network">Network Intelligence</TabsTrigger>
            </TabsList>

            <TabsContent value="incidents" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Incident Trends</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={incidentTrends}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="date" stroke="#9ca3af" />
                        <YAxis stroke="#9ca3af" />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1f2937', 
                            border: '1px solid #374151',
                            borderRadius: '8px'
                          }}
                        />
                        <Line type="monotone" dataKey="incidents" stroke="#ef4444" strokeWidth={2} name="Total Incidents" />
                        <Line type="monotone" dataKey="prevented" stroke="#10b981" strokeWidth={2} name="Prevented" />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Incident Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <span className="text-sm">Total Incidents (7 days)</span>
                      <Badge variant="destructive">{incidentTrends.reduce((sum, day) => sum + day.incidents, 0)}</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <span className="text-sm">Prevented Incidents</span>
                      <Badge variant="default" className="bg-green-500">{incidentTrends.reduce((sum, day) => sum + day.prevented, 0)}</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <span className="text-sm">Prevention Success Rate</span>
                      <Badge variant="outline">
                        {Math.round((incidentTrends.reduce((sum, day) => sum + day.prevented, 0) / incidentTrends.reduce((sum, day) => sum + day.incidents, 0)) * 100)}%
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <span className="text-sm">Average Daily Incidents</span>
                      <Badge variant="secondary">
                        {Math.round(incidentTrends.reduce((sum, day) => sum + day.incidents, 0) / incidentTrends.length)}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="detection" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Detection Method Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={detectionMethods}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={120}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}%`}
                        >
                          {detectionMethods.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Detection Accuracy by Method</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {detectionMethods.map((method) => (
                      <div key={method.name} className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">{method.name}</span>
                          <span className="text-sm text-muted-foreground">
                            {95 + Math.floor(Math.random() * 4)}.{Math.floor(Math.random() * 10)}%
                          </span>
                        </div>
                        <Progress value={95 + Math.floor(Math.random() * 5)} className="h-2" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="patterns" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Hourly Activity Pattern</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={hourlyActivity}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="hour" stroke="#9ca3af" />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#1f2937', 
                          border: '1px solid #374151',
                          borderRadius: '8px'
                        }}
                      />
                      <Bar dataKey="incidents" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Peak Hours</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">6:00 PM - 7:00 PM</span>
                        <Badge variant="destructive">32 incidents</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">3:00 PM - 4:00 PM</span>
                        <Badge variant="destructive">28 incidents</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">2:00 PM - 3:00 PM</span>
                        <Badge variant="destructive">25 incidents</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Low Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm">1:00 AM - 5:00 AM</span>
                        <Badge variant="outline">1 incident</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">11:00 PM - 1:00 AM</span>
                        <Badge variant="outline">4 incidents</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm">6:00 AM - 8:00 AM</span>
                        <Badge variant="outline">8 incidents</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm">
                      <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                        <p className="text-yellow-600">Increase staff during 5-7 PM</p>
                      </div>
                      <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-md">
                        <p className="text-blue-600">Optimize camera coverage for evening hours</p>
                      </div>
                      <div className="p-2 bg-green-500/10 border border-green-500/20 rounded-md">
                        <p className="text-green-600">Reduce overnight monitoring costs</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="network" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Network Stores</p>
                        <p className="text-2xl font-bold">127</p>
                      </div>
                      <Users className="h-8 w-8 text-primary" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Cross-Store Matches</p>
                        <p className="text-2xl font-bold text-orange-500">23</p>
                      </div>
                      <AlertTriangle className="h-8 w-8 text-orange-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Total Debt Recovered</p>
                        <p className="text-2xl font-bold text-green-500">$12.4K</p>
                      </div>
                      <DollarSign className="h-8 w-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Network Intelligence Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-muted/30 rounded-lg">
                      <h4 className="font-medium mb-2">Top Shared Offenders</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Offender #1247</span>
                          <Badge variant="destructive">8 locations</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Offender #0892</span>
                          <Badge variant="destructive">6 locations</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span>Offender #1563</span>
                          <Badge variant="destructive">5 locations</Badge>
                        </div>
                      </div>
                    </div>

                    <div className="p-4 bg-muted/30 rounded-lg">
                      <h4 className="font-medium mb-2">Network Activity</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Intelligence Shared</span>
                          <span className="font-medium">156 alerts</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Successful Identifications</span>
                          <span className="font-medium">89%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Response Time</span>
                          <span className="font-medium">2.1s avg</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}

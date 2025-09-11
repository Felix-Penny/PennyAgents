import { Layout } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { StatsOverview } from "@/components/security/stats-overview";
import { CameraFeed } from "@/components/security/camera-feed";
import { AlertPanel } from "@/components/security/alert-panel";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWebSocket } from "@/hooks/use-websocket";
import { Bell, TriangleAlert, Users, ShieldCheck } from "lucide-react";

export default function Dashboard() {
  const { data: cameras = [] } = useQuery({
    queryKey: ['/api/cameras'],
    queryFn: () => fetch('/api/cameras?storeId=store-1').then(res => res.json())
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['/api/alerts', 'active'],
    queryFn: () => fetch('/api/alerts?active=true&storeId=store-1').then(res => res.json())
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ['/api/incidents'],
    queryFn: () => fetch('/api/incidents?storeId=store-1&limit=5').then(res => res.json())
  });

  const { data: stats } = useQuery({
    queryKey: ['/api/incidents/stats'],
    queryFn: () => fetch('/api/incidents/stats?storeId=store-1').then(res => res.json())
  });

  const { data: preventionRate } = useQuery({
    queryKey: ['/api/analytics/prevention-rate'],
    queryFn: () => fetch('/api/analytics/prevention-rate?storeId=store-1').then(res => res.json())
  });

  useWebSocket();

  const handleSimulateDetection = async () => {
    try {
      await fetch('/api/simulate/detection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          storeId: 'store-1',
          cameraId: cameras[0]?.id || 'camera-1',
          type: 'theft',
          severity: 'high'
        })
      });
    } catch (error) {
      console.error('Failed to simulate detection:', error);
    }
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Security Command Center"
          subtitle="Real-time monitoring and threat detection"
          alertCount={alerts.length}
          networkStatus="active"
        />

        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Real-time Stats */}
          <StatsOverview 
            activeCameras={cameras.filter(c => c.status === 'online').length}
            todayIncidents={stats?.today || 0}
            preventionRate={preventionRate?.rate || 0}
            networkStores={127}
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Live Camera Feeds */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">Live Camera Feeds</CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" data-testid="button-view-all-cameras">
                      View All
                    </Button>
                    <Button size="sm" variant="secondary" data-testid="button-configure-feeds">
                      Configure
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    {cameras.slice(0, 6).map((camera, index) => (
                      <CameraFeed
                        key={camera.id}
                        camera={camera}
                        hasAlert={index === 0}
                        hasOffender={index === 2}
                        data-testid={`camera-feed-${camera.id}`}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Alerts and Activity */}
            <div className="space-y-6">
              <AlertPanel alerts={alerts} />

              {/* Network Intelligence */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-lg">Network Intel</CardTitle>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-xs text-muted-foreground">Connected</span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-primary">Cross-Store Match</p>
                      <p className="text-xs text-muted-foreground">Individual flagged at 3 locations</p>
                    </div>
                    <Button size="sm" data-testid="button-view-network-match">
                      Details
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-green-600">Recovery Update</p>
                      <p className="text-xs text-muted-foreground">$247 debt payment received</p>
                    </div>
                    <Button size="sm" variant="outline" className="bg-green-500 text-white hover:bg-green-600" data-testid="button-view-recovery">
                      View
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-blue-600">Trend Alert</p>
                      <p className="text-xs text-muted-foreground">Increased activity in electronics</p>
                    </div>
                    <Button size="sm" variant="outline" className="bg-blue-500 text-white hover:bg-blue-600" data-testid="button-view-trend">
                      Analyze
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    <Button 
                      variant="outline" 
                      className="flex flex-col h-16 bg-primary/10 hover:bg-primary/20 border-primary/20"
                      data-testid="button-generate-report"
                    >
                      <Bell className="h-5 w-5 text-primary mb-1" />
                      <span className="text-xs text-primary">Generate Report</span>
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="flex flex-col h-16 bg-secondary hover:bg-secondary/80"
                      data-testid="button-export-data"
                    >
                      <TriangleAlert className="h-5 w-5 text-secondary-foreground mb-1" />
                      <span className="text-xs text-secondary-foreground">Export Data</span>
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="flex flex-col h-16 bg-green-500/10 hover:bg-green-500/20 border-green-500/20"
                      data-testid="button-contact-support"
                    >
                      <Users className="h-5 w-5 text-green-600 mb-1" />
                      <span className="text-xs text-green-600">Support</span>
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="flex flex-col h-16 bg-yellow-500/10 hover:bg-yellow-500/20 border-yellow-500/20"
                      onClick={handleSimulateDetection}
                      data-testid="button-simulate-detection"
                    >
                      <ShieldCheck className="h-5 w-5 text-yellow-600 mb-1" />
                      <span className="text-xs text-yellow-600">Simulate Alert</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Detailed Analytics Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Detection Performance */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Detection Performance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Theft Detection Accuracy</span>
                  <span className="text-foreground font-medium">96.8%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full" style={{width: '96.8%'}}></div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">False Positive Rate</span>
                  <span className="text-foreground font-medium">2.1%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-yellow-500 h-2 rounded-full" style={{width: '2.1%'}}></div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Response Time</span>
                  <span className="text-foreground font-medium">4.2s avg</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{width: '85%'}}></div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Incidents */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Recent Incidents</CardTitle>
                <Button variant="link" size="sm" data-testid="button-view-all-incidents">
                  View All
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {incidents.slice(0, 3).map((incident) => (
                  <div key={incident.id} className="flex items-start space-x-3 p-3 bg-muted/50 rounded-lg">
                    <div className="w-8 h-8 bg-destructive/10 rounded-full flex items-center justify-center">
                      <TriangleAlert className="h-4 w-4 text-destructive" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{incident.type}</p>
                      <p className="text-xs text-muted-foreground truncate">{incident.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(incident.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <Badge 
                      variant={incident.status === 'resolved' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {incident.status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}

import { Layout } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AlertPanel } from "@/components/security/alert-panel";
import { AlertModal } from "@/components/security/alert-modal";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { AlertTriangle, CheckCircle, Clock, XCircle, Search, Filter, Archive } from "lucide-react";
import { useState } from "react";
import type { AlertWithRelations } from "@shared/schema";

export default function Alerts() {
  const [selectedAlert, setSelectedAlert] = useState<AlertWithRelations | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();

  const { data: activeAlerts = [] } = useQuery({
    queryKey: ['/api/alerts', 'active'],
    queryFn: () => fetch('/api/alerts?active=true&storeId=store-1').then(res => res.json())
  });

  const { data: allAlerts = [] } = useQuery({
    queryKey: ['/api/alerts', 'all'],
    queryFn: () => fetch('/api/alerts?storeId=store-1&limit=50').then(res => res.json())
  });

  const markReadMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await fetch(`/api/alerts/${alertId}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledgedBy: 'current-user' })
      });
      if (!response.ok) throw new Error('Failed to mark alert as read');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
    }
  });

  const deactivateMutation = useMutation({
    mutationFn: async (alertId: string) => {
      const response = await fetch(`/api/alerts/${alertId}/deactivate`, {
        method: 'PATCH'
      });
      if (!response.ok) throw new Error('Failed to deactivate alert');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/alerts'] });
    }
  });

  const filteredAlerts = allAlerts.filter((alert: AlertWithRelations) => {
    const matchesSearch = alert.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         alert.message.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || alert.type === filterType;
    const matchesSeverity = filterSeverity === 'all' || alert.severity === filterSeverity;
    return matchesSearch && matchesType && matchesSeverity;
  });

  const getAlertIcon = (type: string, severity: string) => {
    if (severity === 'critical') return <AlertTriangle className="h-5 w-5 text-red-500" />;
    if (severity === 'high') return <AlertTriangle className="h-5 w-5 text-orange-500" />;
    if (severity === 'medium') return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    return <AlertTriangle className="h-5 w-5 text-blue-500" />;
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const getTypeLabel = (type: string) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const handleMarkRead = (alertId: string) => {
    markReadMutation.mutate(alertId);
  };

  const handleDeactivate = (alertId: string) => {
    deactivateMutation.mutate(alertId);
    setSelectedAlert(null);
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Alert Management"
          subtitle="Monitor and manage security alerts across your network"
          alertCount={activeAlerts.length}
          networkStatus="active"
        />

        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Stats Cards */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Alerts</p>
                    <p className="text-2xl font-bold text-destructive">{activeAlerts.length}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-destructive" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Critical Alerts</p>
                    <p className="text-2xl font-bold text-orange-500">
                      {activeAlerts.filter((a: AlertWithRelations) => a.severity === 'critical').length}
                    </p>
                  </div>
                  <XCircle className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Resolved Today</p>
                    <p className="text-2xl font-bold text-green-500">
                      {allAlerts.filter((a: AlertWithRelations) => 
                        !a.isActive && 
                        a.createdAt && new Date(a.createdAt).toDateString() === new Date().toDateString()
                      ).length}
                    </p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Response</p>
                    <p className="text-2xl font-bold text-blue-500">4.2s</p>
                  </div>
                  <Clock className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Active Alerts Panel */}
            <div>
              <AlertPanel alerts={activeAlerts} onAlertClick={setSelectedAlert} />
            </div>

            {/* All Alerts Management */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <CardTitle className="text-xl">Alert History</CardTitle>
                    
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search alerts..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 w-64"
                          data-testid="input-search-alerts"
                        />
                      </div>
                      
                      <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="w-40" data-testid="select-filter-type">
                          <Filter className="h-4 w-4 mr-2" />
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          <SelectItem value="theft_in_progress">Theft</SelectItem>
                          <SelectItem value="known_offender_entry">Known Offender</SelectItem>
                          <SelectItem value="aggressive_behavior">Aggressive</SelectItem>
                          <SelectItem value="suspicious_activity">Suspicious</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                        <SelectTrigger className="w-32" data-testid="select-filter-severity">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Severity</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <Tabs defaultValue="all" className="w-full">
                    <TabsList className="mb-4">
                      <TabsTrigger value="all" data-testid="tab-all-alerts">All Alerts</TabsTrigger>
                      <TabsTrigger value="unread" data-testid="tab-unread-alerts">Unread</TabsTrigger>
                      <TabsTrigger value="archived" data-testid="tab-archived-alerts">Archived</TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="all" className="space-y-3">
                      {filteredAlerts.map((alert: AlertWithRelations) => (
                        <div 
                          key={alert.id} 
                          className={`flex items-start space-x-3 p-4 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                            !alert.isRead ? 'bg-muted/30 border-primary/30' : 'bg-muted/10'
                          }`}
                          onClick={() => setSelectedAlert(alert)}
                          data-testid={`alert-item-${alert.id}`}
                        >
                          <div className="flex-shrink-0 mt-1">
                            {getAlertIcon(alert.type, alert.severity || 'medium')}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div>
                                <h3 className="font-medium text-foreground">{alert.title}</h3>
                                <p className="text-sm text-muted-foreground mt-1">{alert.message}</p>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge 
                                    variant="outline" 
                                    className={`text-white ${getSeverityColor(alert.severity || 'medium')}`}
                                  >
                                    {alert.severity}
                                  </Badge>
                                  <Badge variant="outline">
                                    {getTypeLabel(alert.type)}
                                  </Badge>
                                  {alert.camera && (
                                    <span className="text-xs text-muted-foreground">
                                      {alert.camera.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              <div className="flex flex-col items-end gap-2">
                                <span className="text-xs text-muted-foreground">
                                  {alert.createdAt ? new Date(alert.createdAt).toLocaleString() : 'Unknown'}
                                </span>
                                {!alert.isRead && (
                                  <Button 
                                    size="sm" 
                                    variant="outline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMarkRead(alert.id);
                                    }}
                                    data-testid={`button-mark-read-${alert.id}`}
                                  >
                                    Mark Read
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </TabsContent>
                    
                    <TabsContent value="unread" className="space-y-3">
                      {filteredAlerts.filter((a: AlertWithRelations) => !a.isRead).map((alert: AlertWithRelations) => (
                        <div 
                          key={alert.id} 
                          className="flex items-start space-x-3 p-4 bg-muted/30 border border-primary/30 rounded-lg cursor-pointer"
                          onClick={() => setSelectedAlert(alert)}
                          data-testid={`unread-alert-${alert.id}`}
                        >
                          {/* Same content as above */}
                          <div className="flex-shrink-0 mt-1">
                            {getAlertIcon(alert.type, alert.severity || 'medium')}
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium text-foreground">{alert.title}</h3>
                            <p className="text-sm text-muted-foreground">{alert.message}</p>
                          </div>
                        </div>
                      ))}
                    </TabsContent>
                    
                    <TabsContent value="archived" className="space-y-3">
                      {filteredAlerts.filter((a: AlertWithRelations) => !a.isActive).map((alert: AlertWithRelations) => (
                        <div 
                          key={alert.id} 
                          className="flex items-start space-x-3 p-4 bg-muted/10 rounded-lg opacity-75"
                          data-testid={`archived-alert-${alert.id}`}
                        >
                          <Archive className="h-5 w-5 text-muted-foreground mt-1" />
                          <div className="flex-1">
                            <h3 className="font-medium text-foreground">{alert.title}</h3>
                            <p className="text-sm text-muted-foreground">{alert.message}</p>
                            <span className="text-xs text-muted-foreground">
                              Archived • {alert.createdAt ? new Date(alert.createdAt).toLocaleString() : 'Unknown'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </TabsContent>
                  </Tabs>
                  
                  {filteredAlerts.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-muted-foreground">No alerts found matching your criteria.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Detail Modal */}
      {selectedAlert && (
        <AlertModal
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
          onMarkRead={() => handleMarkRead(selectedAlert.id)}
          onDeactivate={() => handleDeactivate(selectedAlert.id)}
        />
      )}
    </Layout>
  );
}

import { Layout } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CameraFeed } from "@/components/security/camera-feed";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, Settings, Grid, List, Filter } from "lucide-react";
import { useState } from "react";
import type { CameraWithStore } from "@shared/schema";

export default function LiveFeeds() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: cameras = [] } = useQuery({
    queryKey: ['/api/cameras'],
    queryFn: () => fetch('/api/cameras?storeId=store-1').then(res => res.json())
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['/api/alerts', 'active'],
    queryFn: () => fetch('/api/alerts?active=true&storeId=store-1').then(res => res.json())
  });

  const filteredCameras = cameras.filter((camera: CameraWithStore) => {
    const matchesSearch = camera.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         camera.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === 'all' || camera.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'offline': return 'bg-red-500';
      case 'maintenance': return 'bg-yellow-500';
      case 'error': return 'bg-orange-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Live Camera Feeds"
          subtitle="Real-time monitoring from all security cameras"
          alertCount={alerts.length}
          networkStatus="active"
        />

        <div className="flex-1 overflow-auto p-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl">Camera Management</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {cameras.filter((c: CameraWithStore) => c.status === 'online').length} of {cameras.length} cameras online
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search cameras..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 w-64"
                      data-testid="input-search-cameras"
                    />
                  </div>
                  
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-32" data-testid="select-filter-status">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="online">Online</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                  
                  <div className="flex border rounded-md">
                    <Button
                      variant={viewMode === 'grid' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('grid')}
                      className="rounded-r-none"
                      data-testid="button-grid-view"
                    >
                      <Grid className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className="rounded-l-none"
                      data-testid="button-list-view"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <Button variant="outline" size="sm" data-testid="button-camera-settings">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              {viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {filteredCameras.map((camera: CameraWithStore, index: number) => (
                    <div key={camera.id} className="relative">
                      <CameraFeed
                        camera={camera}
                        hasAlert={index % 5 === 0}
                        hasOffender={index % 7 === 0}
                        showDetails={true}
                        data-testid={`camera-feed-${camera.id}`}
                      />
                      <div className="mt-2 flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-sm">{camera.name}</h3>
                          <p className="text-xs text-muted-foreground">{camera.location}</p>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={`text-white ${getStatusColor(camera.status || 'offline')}`}
                        >
                          {camera.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredCameras.map((camera: CameraWithStore, index: number) => (
                    <div key={camera.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-12 relative">
                          <CameraFeed
                            camera={camera}
                            hasAlert={index % 5 === 0}
                            hasOffender={index % 7 === 0}
                            compact={true}
                            data-testid={`camera-list-${camera.id}`}
                          />
                        </div>
                        <div>
                          <h3 className="font-medium">{camera.name}</h3>
                          <p className="text-sm text-muted-foreground">{camera.location}</p>
                          {camera.ipAddress && (
                            <p className="text-xs text-muted-foreground">{camera.ipAddress}</p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <div className="text-right text-sm">
                          <p className="text-muted-foreground">Last Seen</p>
                          <p>{camera.lastSeen ? new Date(camera.lastSeen).toLocaleString() : 'Never'}</p>
                        </div>
                        <Badge 
                          variant="outline" 
                          className={`text-white ${getStatusColor(camera.status || 'offline')}`}
                        >
                          {camera.status}
                        </Badge>
                        <Button variant="outline" size="sm" data-testid={`button-camera-config-${camera.id}`}>
                          Configure
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {filteredCameras.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No cameras found matching your criteria.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

import { Layout } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MapPin, Users, Share2, AlertTriangle, DollarSign, Clock, Search, Filter, Building2 } from "lucide-react";
import { useState } from "react";

export default function Network() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');

  const { data: stores = [] } = useQuery({
    queryKey: ['/api/stores'],
    queryFn: () => fetch('/api/stores').then(res => res.json())
  });

  const { data: networkShares = [] } = useQuery({
    queryKey: ['/api/network/shares/store-1'],
    queryFn: () => fetch('/api/network/shares/store-1').then(res => res.json())
  });

  const { data: offenders = [] } = useQuery({
    queryKey: ['/api/offenders'],
    queryFn: () => fetch('/api/offenders?limit=50').then(res => res.json())
  });

  // Mock network data for demonstration
  const networkStats = {
    connectedStores: 127,
    activeShares: 45,
    totalDebtRecovered: 12400,
    crossStoreMatches: 23,
    averageResponseTime: 2.1
  };

  const recentShares = [
    {
      id: '1',
      sourceStore: 'Downtown Location',
      targetStore: 'Mall Branch',
      offenderName: 'John D.',
      sharedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      type: 'theft_alert',
      status: 'active'
    },
    {
      id: '2',
      sourceStore: 'Westside Store',
      targetStore: 'Downtown Location',
      offenderName: 'Jane S.',
      sharedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      type: 'known_offender',
      status: 'acknowledged'
    },
    {
      id: '3',
      sourceStore: 'Mall Branch',
      targetStore: 'All Network',
      offenderName: 'Mike R.',
      sharedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
      type: 'debt_collection',
      status: 'resolved'
    }
  ];

  const getShareTypeColor = (type: string) => {
    switch (type) {
      case 'theft_alert': return 'bg-red-500';
      case 'known_offender': return 'bg-orange-500';
      case 'debt_collection': return 'bg-green-500';
      default: return 'bg-blue-500';
    }
  };

  const getShareTypeLabel = (type: string) => {
    switch (type) {
      case 'theft_alert': return 'Theft Alert';
      case 'known_offender': return 'Known Offender';
      case 'debt_collection': return 'Debt Collection';
      default: return 'Intelligence';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-red-500';
      case 'acknowledged': return 'text-yellow-500';
      case 'resolved': return 'text-green-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Network Intelligence"
          subtitle="Cross-store offender tracking and intelligence sharing"
          alertCount={0}
          networkStatus="active"
        />

        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Network Overview Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Connected Stores</p>
                    <p className="text-2xl font-bold">{networkStats.connectedStores}</p>
                  </div>
                  <Building2 className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Active Shares</p>
                    <p className="text-2xl font-bold text-orange-500">{networkStats.activeShares}</p>
                  </div>
                  <Share2 className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Cross-Store Matches</p>
                    <p className="text-2xl font-bold text-yellow-500">{networkStats.crossStoreMatches}</p>
                  </div>
                  <Users className="h-8 w-8 text-yellow-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Debt Recovered</p>
                    <p className="text-2xl font-bold text-green-500">${networkStats.totalDebtRecovered.toLocaleString()}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-500" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Response</p>
                    <p className="text-2xl font-bold text-blue-500">{networkStats.averageResponseTime}s</p>
                  </div>
                  <Clock className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Network Management Tabs */}
          <Tabs defaultValue="shares" className="space-y-6">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="shares" data-testid="tab-shares">Intelligence Shares</TabsTrigger>
              <TabsTrigger value="stores" data-testid="tab-stores">Network Stores</TabsTrigger>
              <TabsTrigger value="offenders" data-testid="tab-offenders">Cross-Store Offenders</TabsTrigger>
              <TabsTrigger value="recovery" data-testid="tab-recovery">Debt Recovery</TabsTrigger>
            </TabsList>

            <TabsContent value="shares" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <CardTitle className="text-xl">Recent Intelligence Shares</CardTitle>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search shares..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 w-64"
                          data-testid="input-search-shares"
                        />
                      </div>
                      <Button variant="outline" size="sm" data-testid="button-filter-shares">
                        <Filter className="h-4 w-4 mr-2" />
                        Filter
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentShares.map((share) => (
                      <div 
                        key={share.id} 
                        className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                        data-testid={`share-item-${share.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2">
                            <Badge className={`${getShareTypeColor(share.type)} text-white`}>
                              {getShareTypeLabel(share.type)}
                            </Badge>
                            <span className={getStatusColor(share.status)}>●</span>
                          </div>
                          
                          <div>
                            <h3 className="font-medium">
                              {share.sourceStore} → {share.targetStore}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Offender: {share.offenderName} • {share.sharedAt.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={getStatusColor(share.status)}>
                            {share.status}
                          </Badge>
                          <Button variant="outline" size="sm" data-testid={`button-view-share-${share.id}`}>
                            View Details
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stores" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Network Store Directory</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 12 }, (_, i) => ({
                      id: `store-${i + 1}`,
                      name: `Store Location ${i + 1}`,
                      address: `${100 + i * 50} Main St`,
                      city: ['Downtown', 'Westside', 'Mall', 'Uptown', 'Southside', 'Eastgate'][i % 6],
                      status: i % 4 === 0 ? 'offline' : 'online',
                      lastActive: new Date(Date.now() - i * 60 * 60 * 1000),
                      sharesCount: Math.floor(Math.random() * 20) + 5
                    })).map((store) => (
                      <Card 
                        key={store.id} 
                        className="cursor-pointer hover:shadow-lg transition-shadow"
                        data-testid={`store-card-${store.id}`}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h3 className="font-medium text-foreground">{store.name}</h3>
                              <p className="text-sm text-muted-foreground">{store.address}</p>
                              <p className="text-sm text-muted-foreground">{store.city}</p>
                            </div>
                            <div className={`w-3 h-3 rounded-full ${store.status === 'online' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Status:</span>
                              <Badge variant={store.status === 'online' ? 'default' : 'destructive'}>
                                {store.status}
                              </Badge>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Intelligence Shares:</span>
                              <span className="font-medium">{store.sharesCount}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                              <span className="text-muted-foreground">Last Active:</span>
                              <span className="font-medium">{store.lastActive.toLocaleDateString()}</span>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="offenders" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl">Cross-Store Offender Intelligence</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {offenders.slice(0, 8).map((offender) => (
                      <div 
                        key={offender.id} 
                        className="flex items-center justify-between p-4 bg-muted/30 rounded-lg"
                        data-testid={`cross-store-offender-${offender.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={offender.photoUrl || undefined} />
                            <AvatarFallback className="bg-muted">
                              {(offender.firstName?.[0] || '') + (offender.lastName?.[0] || '')}
                            </AvatarFallback>
                          </Avatar>
                          
                          <div>
                            <h3 className="font-medium">
                              {offender.firstName} {offender.lastName}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                              Risk Level: {offender.riskLevel} • Debt: ${parseFloat(offender.totalDebt || '0').toLocaleString()}
                            </p>
                            {offender.lastSeenAt && (
                              <p className="text-xs text-muted-foreground">
                                Last seen: {new Date(offender.lastSeenAt).toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="text-right text-sm">
                            <p className="text-muted-foreground">Locations</p>
                            <p className="font-medium">{Math.floor(Math.random() * 5) + 2}</p>
                          </div>
                          <Button variant="outline" size="sm" data-testid={`button-view-matches-${offender.id}`}>
                            <MapPin className="h-4 w-4 mr-2" />
                            View Matches
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="recovery" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Debt Recovery Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <span className="text-sm">Total Outstanding Debt</span>
                      <Badge variant="destructive" className="text-lg px-3 py-1">$24,650</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <span className="text-sm">Recovered This Month</span>
                      <Badge variant="default" className="bg-green-500 text-lg px-3 py-1">$12,400</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <span className="text-sm">Recovery Rate</span>
                      <Badge variant="outline" className="text-lg px-3 py-1">67%</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                      <span className="text-sm">Active Cases</span>
                      <Badge variant="secondary" className="text-lg px-3 py-1">23</Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Recent Recovery Activity</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { amount: 247, offender: 'John D.', store: 'Downtown', date: '2 hours ago' },
                      { amount: 89, offender: 'Sarah M.', store: 'Mall Branch', date: '1 day ago' },
                      { amount: 156, offender: 'Mike R.', store: 'Westside', date: '3 days ago' },
                      { amount: 312, offender: 'Lisa K.', store: 'Uptown', date: '1 week ago' }
                    ].map((recovery, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <div>
                          <p className="text-sm font-medium text-green-600">+${recovery.amount}</p>
                          <p className="text-xs text-muted-foreground">{recovery.offender} • {recovery.store}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">{recovery.date}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Outstanding Debts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {offenders
                      .filter(o => parseFloat(o.totalDebt || '0') > 0)
                      .slice(0, 6)
                      .map((offender) => (
                        <div 
                          key={offender.id} 
                          className="flex items-center justify-between p-3 bg-red-500/10 border border-red-500/20 rounded-lg"
                          data-testid={`debt-item-${offender.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={offender.photoUrl || undefined} />
                              <AvatarFallback className="bg-muted text-xs">
                                {(offender.firstName?.[0] || '') + (offender.lastName?.[0] || '')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{offender.firstName} {offender.lastName}</p>
                              <p className="text-xs text-muted-foreground">Multiple locations</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <Badge variant="destructive" className="text-sm">
                              ${parseFloat(offender.totalDebt || '0').toLocaleString()}
                            </Badge>
                            <Button variant="outline" size="sm" data-testid={`button-collect-debt-${offender.id}`}>
                              Collect
                            </Button>
                          </div>
                        </div>
                      ))}
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

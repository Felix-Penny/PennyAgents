import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Network, MapPin, Users, AlertTriangle, Share2, Search, Eye } from "lucide-react";

type NetworkOffender = {
  id: string;
  name: string;
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
  lastSeen: string;
  locations: string[];
  totalIncidents: number;
  sharedBy: string;
};

type NetworkAlert = {
  id: string;
  offenderId: string;
  offenderName: string;
  location: string;
  store: string;
  detectedAt: string;
  confidence: number;
  status: "NEW" | "ACKNOWLEDGED" | "DISMISSED";
};

export default function NetworkPage() {
  const [searchTerm, setSearchTerm] = useState("");
  
  const [networkOffenders] = useState<NetworkOffender[]>([
    {
      id: "net-off-001",
      name: "John Smith",
      riskLevel: "HIGH",
      lastSeen: "1 day ago",
      locations: ["Downtown Store", "Mall Location", "Airport Store"],
      totalIncidents: 8,
      sharedBy: "Downtown Store"
    },
    {
      id: "net-off-002", 
      name: "Sarah Wilson",
      riskLevel: "MEDIUM",
      lastSeen: "3 days ago",
      locations: ["Mall Location", "Suburbs Store"],
      totalIncidents: 4,
      sharedBy: "Mall Location"
    },
    {
      id: "net-off-003",
      name: "Unknown Subject #3",
      riskLevel: "HIGH",
      lastSeen: "2 hours ago", 
      locations: ["Downtown Store"],
      totalIncidents: 3,
      sharedBy: "Downtown Store"
    }
  ]);

  const [networkAlerts] = useState<NetworkAlert[]>([
    {
      id: "net-alert-001",
      offenderId: "net-off-001",
      offenderName: "John Smith", 
      location: "Main Entrance",
      store: "Downtown Store",
      detectedAt: "2 minutes ago",
      confidence: 94,
      status: "NEW"
    },
    {
      id: "net-alert-002",
      offenderId: "net-off-003",
      offenderName: "Unknown Subject #3",
      location: "Electronics Section", 
      store: "Your Store",
      detectedAt: "15 minutes ago",
      confidence: 87,
      status: "ACKNOWLEDGED"
    }
  ]);

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case "HIGH":
        return <Badge variant="destructive">High Risk</Badge>;
      case "MEDIUM":
        return <Badge className="bg-orange-100 text-orange-800">Medium Risk</Badge>;
      case "LOW":
        return <Badge variant="secondary">Low Risk</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "NEW":
        return <Badge className="bg-red-100 text-red-800">New</Badge>;
      case "ACKNOWLEDGED":
        return <Badge className="bg-yellow-100 text-yellow-800">Acknowledged</Badge>;
      case "DISMISSED":
        return <Badge className="bg-gray-100 text-gray-800">Dismissed</Badge>;
    }
  };

  const filteredOffenders = networkOffenders.filter(offender =>
    offender.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    offender.locations.some(loc => loc.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Network Intelligence</h1>
          <p className="text-muted-foreground">Cross-store security intelligence and threat sharing</p>
        </div>
        <Badge variant="outline" className="text-blue-600">
          <Network className="w-4 h-4 mr-1" />
          Connected to 12 stores
        </Badge>
      </div>

      {/* Network Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card data-testid="card-network-offenders">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Network Offenders</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{networkOffenders.length}</div>
            <p className="text-xs text-muted-foreground">Shared across network</p>
          </CardContent>
        </Card>

        <Card data-testid="card-active-alerts">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {networkAlerts.filter(a => a.status === "NEW").length}
            </div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>

        <Card data-testid="card-shared-locations">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Shared Locations</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">Connected stores</p>
          </CardContent>
        </Card>

        <Card data-testid="card-data-shared">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Shared</CardTitle>
            <Share2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">847</div>
            <p className="text-xs text-muted-foreground">Records this month</p>
          </CardContent>
        </Card>
      </div>

      {/* Network Tabs */}
      <Tabs defaultValue="alerts" className="w-full">
        <TabsList>
          <TabsTrigger value="alerts">Network Alerts ({networkAlerts.length})</TabsTrigger>
          <TabsTrigger value="offenders">Shared Offenders ({networkOffenders.length})</TabsTrigger>
          <TabsTrigger value="analytics">Network Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Network Alerts</CardTitle>
              <CardDescription>Security alerts from connected stores in your network</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {networkAlerts.map((alert) => (
                <div key={alert.id} className="border rounded-lg p-4" data-testid={`card-network-alert-${alert.id}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-medium">{alert.offenderName} detected</h4>
                      <p className="text-sm text-muted-foreground">
                        {alert.location} at {alert.store}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{alert.confidence}% confidence</Badge>
                      {getStatusBadge(alert.status)}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">{alert.detectedAt}</span>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        data-testid={`button-view-alert-${alert.id}`}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View Details
                      </Button>
                      {alert.status === "NEW" && (
                        <Button 
                          size="sm"
                          data-testid={`button-acknowledge-${alert.id}`}
                        >
                          Acknowledge
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="offenders" className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search network offenders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-search-network-offenders"
            />
          </div>

          {/* Offenders Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredOffenders.map((offender) => (
              <Card key={offender.id} data-testid={`card-network-offender-${offender.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{offender.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Shared by {offender.sharedBy}
                      </p>
                    </div>
                    {getRiskBadge(offender.riskLevel)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Last Seen:</span>
                      <p className="font-medium">{offender.lastSeen}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Incidents:</span>
                      <p className="font-medium">{offender.totalIncidents}</p>
                    </div>
                  </div>

                  <div>
                    <span className="text-muted-foreground text-sm">Active Locations:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {offender.locations.map((location, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          <MapPin className="h-3 w-3 mr-1" />
                          {location}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline"
                      data-testid={`button-view-network-profile-${offender.id}`}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View Profile
                    </Button>
                    <Button 
                      size="sm"
                      data-testid={`button-add-to-local-${offender.id}`}
                    >
                      Add to Local Database
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-testid="card-network-activity">
              <CardHeader>
                <CardTitle>Network Activity</CardTitle>
                <CardDescription>Cross-store detection patterns</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Most Active Store</span>
                  <Badge>Downtown Store (23 alerts)</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Peak Activity Time</span>
                  <Badge variant="outline">2PM - 4PM</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Cross-Store Matches</span>
                  <Badge variant="outline">15 this week</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Data Accuracy</span>
                  <Badge className="bg-green-100 text-green-800">91.2%</Badge>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-sharing-metrics">
              <CardHeader>
                <CardTitle>Sharing Metrics</CardTitle>
                <CardDescription>Intelligence sharing effectiveness</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span>Data Sent</span>
                  <Badge variant="outline">234 records</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Data Received</span>
                  <Badge variant="outline">613 records</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Prevented Incidents</span>
                  <Badge className="bg-green-100 text-green-800">8 this month</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span>Network Score</span>
                  <Badge className="bg-blue-100 text-blue-800">Excellent</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Users, AlertTriangle, Eye, Plus } from "lucide-react";

type OffenderStatus = "ACTIVE" | "INACTIVE" | "PENDING";

type Offender = {
  id: string;
  name: string;
  aliases: string[];
  status: OffenderStatus;
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
  lastSeen: string;
  totalIncidents: number;
  description: string;
  thumbnailUrl?: string;
};

export default function Offenders() {
  const [searchTerm, setSearchTerm] = useState("");
  const [offenders] = useState<Offender[]>([
    {
      id: "off-001",
      name: "John Smith",
      aliases: ["J. Smith", "Johnny"],
      status: "ACTIVE",
      riskLevel: "HIGH",
      lastSeen: "2 days ago",
      totalIncidents: 5,
      description: "Known for shoplifting electronics and tools"
    },
    {
      id: "off-002",
      name: "Sarah Johnson",
      aliases: ["S. Johnson"],
      status: "ACTIVE",
      riskLevel: "MEDIUM",
      lastSeen: "1 week ago",
      totalIncidents: 3,
      description: "Previous incidents in cosmetics section"
    },
    {
      id: "off-003",
      name: "Mike Davis",
      aliases: ["M. Davis", "Michael D."],
      status: "INACTIVE",
      riskLevel: "LOW",
      lastSeen: "3 months ago",
      totalIncidents: 1,
      description: "Single incident, possible mistake"
    },
    {
      id: "off-004",
      name: "Unknown Subject #1",
      aliases: [],
      status: "PENDING",
      riskLevel: "HIGH",
      lastSeen: "1 day ago",
      totalIncidents: 2,
      description: "Unidentified individual, pending facial recognition"
    }
  ]);

  const getStatusBadge = (status: OffenderStatus) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-red-100 text-red-800">Active</Badge>;
      case "INACTIVE":
        return <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>;
      case "PENDING":
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
    }
  };

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

  const filteredOffenders = offenders.filter(offender =>
    offender.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    offender.aliases.some(alias => alias.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Offender Database</h1>
          <p className="text-muted-foreground">Manage known security threats and offenders</p>
        </div>
        <Button data-testid="button-add-offender">
          <Plus className="h-4 w-4 mr-2" />
          Add Offender
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-total-offenders">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Offenders</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{offenders.length}</div>
          </CardContent>
        </Card>

        <Card data-testid="card-active-offenders">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {offenders.filter(o => o.status === "ACTIVE").length}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-high-risk">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Risk</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {offenders.filter(o => o.riskLevel === "HIGH").length}
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-pending-review">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Eye className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {offenders.filter(o => o.status === "PENDING").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          placeholder="Search offenders by name or alias..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
          data-testid="input-search-offenders"
        />
      </div>

      {/* Offenders List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {filteredOffenders.map((offender) => (
          <Card key={offender.id} className="overflow-hidden" data-testid={`card-offender-${offender.id}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-gray-200">
                      {offender.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-lg">{offender.name}</CardTitle>
                    {offender.aliases.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Also known as: {offender.aliases.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  {getStatusBadge(offender.status)}
                  {getRiskBadge(offender.riskLevel)}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm">{offender.description}</p>
              
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

              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  variant="outline"
                  data-testid={`button-view-incidents-${offender.id}`}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View Incidents
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  data-testid={`button-edit-${offender.id}`}
                >
                  Edit Profile
                </Button>
                {offender.status === "PENDING" && (
                  <Button 
                    size="sm"
                    data-testid={`button-approve-${offender.id}`}
                  >
                    Approve
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredOffenders.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">No offenders found</h3>
            <p className="text-muted-foreground">
              {searchTerm ? "Try adjusting your search terms" : "No offenders in the database"}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertTriangle, Clock, User, FileText, Search, Filter, Plus, Eye, ArrowUpRight, Users, CheckCircle2, XCircle, AlertCircle, Timer } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket as useWebSocketProvider } from "@/lib/websocket";
import { apiRequest } from "@/lib/queryClient";

type IncidentStatus = "OPEN" | "INVESTIGATING" | "RESOLVED" | "CLOSED";
type IncidentPriority = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

interface Incident {
  id: string;
  title: string;
  description: string;
  type: string;
  status: IncidentStatus;
  priority: IncidentPriority;
  storeId: string;
  reportedBy: string;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  location?: {
    area: string;
    coordinates?: { x: number; y: number };
    floor?: string;
  };
  metadata?: Record<string, any>;
}

interface IncidentDashboard {
  incidents: Incident[];
  summary: {
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    avgResolutionTime: number;
    unassigned: number;
  };
  recentActivity: any[];
}

export default function Incidents() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { sendMessage, isConnected } = useWebSocketProvider();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedIncidents, setSelectedIncidents] = useState<string[]>([]);

  // Fetch incident dashboard data
  const { data: dashboardData, isLoading, refetch } = useQuery<IncidentDashboard>({
    queryKey: ['/api/store', user?.storeId, 'incidents/dashboard'],
    queryFn: async (): Promise<IncidentDashboard> => {
      if (!user?.storeId) throw new Error('No store ID available');
      const response = await fetch(`/api/store/${user.storeId}/incidents/dashboard`);
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      return response.json();
    },
    enabled: !!user?.storeId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Create incident mutation
  const createIncidentMutation = useMutation({
    mutationFn: async (incidentData: any) => {
      return apiRequest('POST', `/api/store/${user?.storeId}/incidents`, incidentData);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Incident created successfully" });
      setShowCreateDialog(false);
      queryClient.invalidateQueries({ queryKey: ['/api/store', user?.storeId, 'incidents'] });
      refetch();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to create incident",
        variant: "destructive" 
      });
    },
  });

  // Escalate alert to incident mutation
  const escalateAlertMutation = useMutation({
    mutationFn: async ({ alertId, data }: { alertId: string; data: any }) => {
      return apiRequest('POST', `/api/alerts/${alertId}/escalate-to-incident`, data);
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Alert escalated to incident successfully" });
      refetch();
    },
    onError: (error: any) => {
      toast({ 
        title: "Error", 
        description: error.message || "Failed to escalate alert",
        variant: "destructive" 
      });
    },
  });

  // Filter incidents based on search and filters
  const filteredIncidents = (dashboardData?.incidents || []).filter(incident => {
    const matchesSearch = searchTerm === "" || 
      incident.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      incident.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || incident.status === statusFilter;
    const matchesPriority = priorityFilter === "all" || incident.priority === priorityFilter;
    const matchesAssignee = assigneeFilter === "all" || 
      (assigneeFilter === "unassigned" && !incident.assignedTo) ||
      (assigneeFilter === "assigned" && incident.assignedTo);
    
    return matchesSearch && matchesStatus && matchesPriority && matchesAssignee;
  });

  const getStatusIcon = (status: IncidentStatus) => {
    switch (status) {
      case "OPEN": return <AlertCircle className="h-4 w-4 text-red-500" />;
      case "INVESTIGATING": return <Timer className="h-4 w-4 text-yellow-500" />;
      case "RESOLVED": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "CLOSED": return <XCircle className="h-4 w-4 text-gray-500" />;
      default: return <AlertCircle className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: IncidentPriority) => {
    switch (priority) {
      case "CRITICAL": return "bg-red-500 text-white";
      case "HIGH": return "bg-orange-500 text-white";
      case "MEDIUM": return "bg-yellow-500 text-black";
      case "LOW": return "bg-green-500 text-white";
      default: return "bg-gray-500 text-white";
    }
  };

  const formatTimeAgo = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Unknown time';
      
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      
      if (diffMinutes < 1) return 'Just now';
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      
      const diffDays = Math.floor(diffHours / 24);
      return `${diffDays}d ago`;
    } catch (error) {
      return 'Unknown time';
    }
  };

  const handleCreateIncident = (data: any) => {
    createIncidentMutation.mutate(data);
  };

  const handleEscalateAlert = (alertId: string, data: any) => {
    escalateAlertMutation.mutate({ alertId, data });
  };

  const handleIncidentSelect = (incidentId: string, selected: boolean) => {
    if (selected) {
      setSelectedIncidents(prev => [...prev, incidentId]);
    } else {
      setSelectedIncidents(prev => prev.filter(id => id !== incidentId));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100" data-testid="page-title">
            Incident Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Comprehensive incident lifecycle management and evidence tracking
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-incident">
              <Plus className="h-4 w-4 mr-2" />
              Create Incident
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Incident</DialogTitle>
            </DialogHeader>
            <IncidentForm onSubmit={handleCreateIncident} isLoading={createIncidentMutation.isPending} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Dashboard Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Incidents</p>
                <p className="text-2xl font-bold" data-testid="stat-total-incidents">
                  {dashboardData?.summary.total || 0}
                </p>
              </div>
              <FileText className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Open</p>
                <p className="text-2xl font-bold text-red-600" data-testid="stat-open-incidents">
                  {dashboardData?.summary.byStatus.OPEN || 0}
                </p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Investigating</p>
                <p className="text-2xl font-bold text-yellow-600" data-testid="stat-investigating-incidents">
                  {dashboardData?.summary.byStatus.INVESTIGATING || 0}
                </p>
              </div>
              <Timer className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Unassigned</p>
                <p className="text-2xl font-bold text-orange-600" data-testid="stat-unassigned-incidents">
                  {dashboardData?.summary.unassigned || 0}
                </p>
              </div>
              <Users className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Avg Resolution</p>
                <p className="text-2xl font-bold text-green-600" data-testid="stat-avg-resolution">
                  {dashboardData?.summary.avgResolutionTime || 0}m
                </p>
              </div>
              <Clock className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search incidents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-search-incidents"
              />
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger data-testid="select-status-filter">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="INVESTIGATING">Investigating</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
                <SelectItem value="CLOSED">Closed</SelectItem>
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger data-testid="select-priority-filter">
                <SelectValue placeholder="All Priorities" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="CRITICAL">Critical</SelectItem>
                <SelectItem value="HIGH">High</SelectItem>
                <SelectItem value="MEDIUM">Medium</SelectItem>
                <SelectItem value="LOW">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger data-testid="select-assignee-filter">
                <SelectValue placeholder="All Assignments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="assigned">Assigned</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={() => {
              setSearchTerm("");
              setStatusFilter("all");
              setPriorityFilter("all");
              setAssigneeFilter("all");
            }} data-testid="button-clear-filters">
              <Filter className="h-4 w-4 mr-2" />
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Incidents List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Incidents ({filteredIncidents.length})</span>
            {selectedIncidents.length > 0 && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline">
                  Bulk Assign ({selectedIncidents.length})
                </Button>
                <Button size="sm" variant="outline">
                  Bulk Update Status
                </Button>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-2">
            {filteredIncidents.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No incidents found matching your filters</p>
              </div>
            ) : (
              filteredIncidents.map((incident) => (
                <div
                  key={incident.id}
                  className="border-b border-gray-200 dark:border-gray-700 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  data-testid={`incident-card-${incident.id}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      <input
                        type="checkbox"
                        checked={selectedIncidents.includes(incident.id)}
                        onChange={(e) => handleIncidentSelect(incident.id, e.target.checked)}
                        className="rounded"
                        data-testid={`checkbox-incident-${incident.id}`}
                      />
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          {getStatusIcon(incident.status)}
                          <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                            {incident.title}
                          </h3>
                          <Badge className={getPriorityColor(incident.priority)} data-testid={`badge-priority-${incident.id}`}>
                            {incident.priority}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {incident.description}
                        </p>
                        
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>ID: {incident.id.slice(0, 8)}</span>
                          <span>{formatTimeAgo(incident.createdAt)}</span>
                          {incident.assignedTo && (
                            <span className="flex items-center">
                              <User className="h-3 w-3 mr-1" />
                              Assigned
                            </span>
                          )}
                          {incident.location && (
                            <span>{incident.location.area}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button size="sm" variant="outline" data-testid={`button-view-${incident.id}`}>
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button size="sm" variant="outline" data-testid={`button-details-${incident.id}`}>
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Basic Incident Form Component
function IncidentForm({ onSubmit, isLoading }: { onSubmit: (data: any) => void; isLoading: boolean }) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "SECURITY_BREACH",
    priority: "MEDIUM",
    location: {
      area: "",
      floor: ""
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Title</label>
        <Input
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Brief incident title"
          required
          data-testid="input-incident-title"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Description</label>
        <Input
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Detailed incident description"
          required
          data-testid="input-incident-description"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Type</label>
          <Select 
            value={formData.type} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
          >
            <SelectTrigger data-testid="select-incident-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SECURITY_BREACH">Security Breach</SelectItem>
              <SelectItem value="THEFT">Theft</SelectItem>
              <SelectItem value="VANDALISM">Vandalism</SelectItem>
              <SelectItem value="SUSPICIOUS_ACTIVITY">Suspicious Activity</SelectItem>
              <SelectItem value="EMERGENCY">Emergency</SelectItem>
              <SelectItem value="TECHNICAL_ISSUE">Technical Issue</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Priority</label>
          <Select 
            value={formData.priority} 
            onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
          >
            <SelectTrigger data-testid="select-incident-priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CRITICAL">Critical</SelectItem>
              <SelectItem value="HIGH">High</SelectItem>
              <SelectItem value="MEDIUM">Medium</SelectItem>
              <SelectItem value="LOW">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">Location Area</label>
          <Input
            value={formData.location.area}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              location: { ...prev.location, area: e.target.value }
            }))}
            placeholder="e.g., Main Entrance"
            data-testid="input-incident-location"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Floor</label>
          <Input
            value={formData.location.floor}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              location: { ...prev.location, floor: e.target.value }
            }))}
            placeholder="e.g., Ground Floor"
            data-testid="input-incident-floor"
          />
        </div>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={() => {}}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading} data-testid="button-submit-incident">
          {isLoading ? "Creating..." : "Create Incident"}
        </Button>
      </div>
    </form>
  );
}
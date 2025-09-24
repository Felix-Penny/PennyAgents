import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { 
  FileBarChart, Download, Calendar, Clock, User, Settings, 
  Plus, Filter, Search, MoreHorizontal, Eye, Trash2
} from "lucide-react";

interface ReportsCenterProps {
  storeId?: string;
}

interface Report {
  id: string;
  title: string;
  type: "executive" | "operational" | "tactical" | "compliance";
  period: string;
  generatedAt: Date;
  summary: {
    totalIncidents: number;
    preventedThefts: number;
    costSavings: number;
    systemEfficiency: number;
  };
  fileUrl?: string;
}

export default function ReportsCenter({ storeId }: ReportsCenterProps) {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [newReport, setNewReport] = useState({
    title: "",
    type: "operational" as const,
    period: "monthly",
    includeCharts: true,
    includeRecommendations: true
  });
  const [scheduleConfig, setScheduleConfig] = useState({
    frequency: "monthly" as const,
    dayOfWeek: 1,
    dayOfMonth: 1,
    time: "09:00"
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Get reports
  const { data: reports, isLoading } = useQuery({
    queryKey: ['/api/analytics/reports', {
      storeId,
      type: filterType !== "all" ? filterType : undefined,
      limit: 50
    }]
  });

  // Generate report mutation
  const generateReportMutation = useMutation({
    mutationFn: async (reportData: any) => {
      const response = await fetch('/api/analytics/reports/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...reportData,
          storeId,
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        })
      });
      if (!response.ok) throw new Error('Failed to generate report');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/reports'] });
      toast({
        title: "Report Generated",
        description: "Your security analytics report has been generated successfully."
      });
      setIsCreateDialogOpen(false);
      setNewReport({
        title: "",
        type: "operational",
        period: "monthly",
        includeCharts: true,
        includeRecommendations: true
      });
    },
    onError: () => {
      toast({
        title: "Generation Failed",
        description: "Failed to generate the report. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Schedule report mutation
  const scheduleReportMutation = useMutation({
    mutationFn: async (scheduleData: any) => {
      const response = await fetch('/api/analytics/reports/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...scheduleData,
          storeId
        })
      });
      if (!response.ok) throw new Error('Failed to schedule report');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Report Scheduled",
        description: "Your automated report has been scheduled successfully."
      });
      setIsScheduleDialogOpen(false);
    },
    onError: () => {
      toast({
        title: "Scheduling Failed",
        description: "Failed to schedule the report. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleGenerateReport = () => {
    if (!newReport.title.trim()) {
      toast({
        title: "Title Required",
        description: "Please enter a title for your report.",
        variant: "destructive"
      });
      return;
    }
    generateReportMutation.mutate(newReport);
  };

  const handleScheduleReport = () => {
    if (!newReport.title.trim()) {
      toast({
        title: "Title Required",
        description: "Please enter a title for your scheduled report.",
        variant: "destructive"
      });
      return;
    }
    scheduleReportMutation.mutate({
      ...newReport,
      scheduleConfig
    });
  };

  const getReportTypeColor = (type: string) => {
    switch (type) {
      case "executive": return "bg-purple-100 text-purple-800";
      case "operational": return "bg-blue-100 text-blue-800";
      case "tactical": return "bg-green-100 text-green-800";
      case "compliance": return "bg-orange-100 text-orange-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const filteredReports = (reports || []).filter((report: Report) => {
    const matchesSearch = report.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterType === "all" || report.type === filterType;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Reports Center</h2>
          <p className="text-muted-foreground">Generate and manage security analytics reports</p>
        </div>
        <div className="flex items-center gap-2">
          <Dialog open={isScheduleDialogOpen} onOpenChange={setIsScheduleDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="button-schedule-report">
                <Calendar className="h-4 w-4 mr-1" />
                Schedule Report
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule Automated Report</DialogTitle>
                <DialogDescription>
                  Set up recurring report generation with automated delivery
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="schedule-title">Report Title</Label>
                  <Input
                    id="schedule-title"
                    value={newReport.title}
                    onChange={(e) => setNewReport({ ...newReport, title: e.target.value })}
                    placeholder="e.g., Weekly Security Summary"
                  />
                </div>
                <div>
                  <Label htmlFor="schedule-type">Report Type</Label>
                  <Select value={newReport.type} onValueChange={(value: any) => setNewReport({ ...newReport, type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="executive">Executive Summary</SelectItem>
                      <SelectItem value="operational">Operational Report</SelectItem>
                      <SelectItem value="tactical">Tactical Intelligence</SelectItem>
                      <SelectItem value="compliance">Compliance Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="frequency">Frequency</Label>
                  <Select value={scheduleConfig.frequency} onValueChange={(value: any) => setScheduleConfig({ ...scheduleConfig, frequency: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="time">Time</Label>
                  <Input
                    id="time"
                    type="time"
                    value={scheduleConfig.time}
                    onChange={(e) => setScheduleConfig({ ...scheduleConfig, time: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsScheduleDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleScheduleReport}
                  disabled={scheduleReportMutation.isPending}
                >
                  Schedule Report
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-generate-report">
                <Plus className="h-4 w-4 mr-1" />
                Generate Report
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Generate New Report</DialogTitle>
                <DialogDescription>
                  Create a comprehensive security analytics report
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Report Title</Label>
                  <Input
                    id="title"
                    value={newReport.title}
                    onChange={(e) => setNewReport({ ...newReport, title: e.target.value })}
                    placeholder="e.g., Monthly Security Analysis"
                  />
                </div>
                <div>
                  <Label htmlFor="type">Report Type</Label>
                  <Select value={newReport.type} onValueChange={(value: any) => setNewReport({ ...newReport, type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="executive">Executive Summary</SelectItem>
                      <SelectItem value="operational">Operational Report</SelectItem>
                      <SelectItem value="tactical">Tactical Intelligence</SelectItem>
                      <SelectItem value="compliance">Compliance Report</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="period">Period</Label>
                  <Select value={newReport.period} onValueChange={(value) => setNewReport({ ...newReport, period: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="charts"
                    checked={newReport.includeCharts}
                    onChange={(e) => setNewReport({ ...newReport, includeCharts: e.target.checked })}
                  />
                  <Label htmlFor="charts">Include Charts and Visualizations</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="recommendations"
                    checked={newReport.includeRecommendations}
                    onChange={(e) => setNewReport({ ...newReport, includeRecommendations: e.target.checked })}
                  />
                  <Label htmlFor="recommendations">Include Recommendations</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleGenerateReport}
                  disabled={generateReportMutation.isPending}
                >
                  {generateReportMutation.isPending ? "Generating..." : "Generate Report"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
        <div className="flex-1 flex items-center gap-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-0 bg-transparent"
            data-testid="input-search-reports"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[160px]" data-testid="select-filter-type">
            <Filter className="h-4 w-4 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="executive">Executive</SelectItem>
            <SelectItem value="operational">Operational</SelectItem>
            <SelectItem value="tactical">Tactical</SelectItem>
            <SelectItem value="compliance">Compliance</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="animate-pulse space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredReports.length > 0 ? (
          filteredReports.map((report: Report) => (
            <Card key={report.id} data-testid={`card-report-${report.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileBarChart className="h-5 w-5" />
                      {report.title}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Generated on {format(new Date(report.generatedAt), 'PPP')}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getReportTypeColor(report.type)}>
                      {report.type}
                    </Badge>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center">
                    <div className="font-bold text-lg">{report.summary.totalIncidents}</div>
                    <p className="text-sm text-muted-foreground">Total Incidents</p>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-lg text-green-600">{report.summary.preventedThefts}</div>
                    <p className="text-sm text-muted-foreground">Prevented</p>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-lg text-blue-600">
                      ${report.summary.costSavings.toLocaleString()}
                    </div>
                    <p className="text-sm text-muted-foreground">Cost Savings</p>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-lg">{Math.round(report.summary.systemEfficiency)}%</div>
                    <p className="text-sm text-muted-foreground">Efficiency</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {report.period}
                    </span>
                    <span className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      System Generated
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" data-testid={`button-view-${report.id}`}>
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                    <Button variant="outline" size="sm" data-testid={`button-download-${report.id}`}>
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="text-center py-12">
              <FileBarChart className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No reports found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || filterType !== "all" 
                  ? "No reports match your search criteria" 
                  : "Generate your first security analytics report"}
              </p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Generate Report
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {
          setNewReport({ ...newReport, title: "Weekly Executive Summary", type: "executive", period: "weekly" });
          setIsCreateDialogOpen(true);
        }}>
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <FileBarChart className="h-6 w-6 text-purple-600" />
            </div>
            <h3 className="font-medium mb-1">Executive Summary</h3>
            <p className="text-sm text-muted-foreground">High-level KPIs and trends for leadership</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {
          setNewReport({ ...newReport, title: "Monthly Operational Report", type: "operational", period: "monthly" });
          setIsCreateDialogOpen(true);
        }}>
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Settings className="h-6 w-6 text-blue-600" />
            </div>
            <h3 className="font-medium mb-1">Operational Report</h3>
            <p className="text-sm text-muted-foreground">Detailed metrics for security managers</p>
          </CardContent>
        </Card>

        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {
          setNewReport({ ...newReport, title: "Compliance Audit Report", type: "compliance", period: "quarterly" });
          setIsCreateDialogOpen(true);
        }}>
          <CardContent className="p-6 text-center">
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-3">
              <Clock className="h-6 w-6 text-orange-600" />
            </div>
            <h3 className="font-medium mb-1">Compliance Report</h3>
            <p className="text-sm text-muted-foreground">Regulatory compliance and audit trails</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
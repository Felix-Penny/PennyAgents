import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Eye, 
  Users, 
  Shield, 
  AlertTriangle, 
  Camera, 
  Activity, 
  Clock, 
  FileText, 
  BarChart3,
  Plus,
  Search,
  Edit,
  Trash2,
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
  UserCheck,
  UserX,
  Brain,
  Target,
  Lock
} from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

// TypeScript interfaces for facial recognition data
interface FacialRecognitionStats {
  totalFacesDetected: number;
  uniquePersonsIdentified: number;
  watchlistMatches: number;
  consentCompliance: number;
  averageConfidence: number;
  totalEvents: number;
}

interface WatchlistEntry {
  id: string;
  personId: string;
  watchlistType: 'security_threat' | 'banned_individual' | 'person_of_interest';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  addedBy: string;
  reason: string;
  evidenceFiles: string[];
  legalAuthorization?: string;
  autoExpiry?: Date;
  notifications: {
    email: boolean;
    sms: boolean;
    realtime: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface FacialRecognitionEvent {
  id: string;
  storeId: string;
  cameraId: string;
  detectionTimestamp: Date;
  faceAttributes: {
    confidence: number;
    boundingBox?: any;
    watchlistMatch: boolean;
    personId?: string;
    templateId?: string;
  };
  matchConfidence: number;
  processingTimeMs: number;
  consentVerified: boolean;
}

interface ConsentRecord {
  id: string;
  personId: string;
  consentGiven: boolean;
  consentType: 'explicit' | 'implicit' | 'legitimate_interest';
  legalBasis: string;
  consentDate: Date;
  expiryDate?: Date;
  revokedAt?: Date;
  ipAddress: string;
  userAgent: string;
}

// Form schemas
const watchlistEntrySchema = z.object({
  personId: z.string().min(1, "Person ID is required"),
  watchlistType: z.enum(['security_threat', 'banned_individual', 'person_of_interest']),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  reason: z.string().min(10, "Reason must be at least 10 characters"),
  legalAuthorization: z.string().optional(),
  autoExpiry: z.string().optional(),
  notifications: z.object({
    email: z.boolean(),
    sms: z.boolean(),
    realtime: z.boolean(),
  })
});

type WatchlistEntryForm = z.infer<typeof watchlistEntrySchema>;

const consentManagementSchema = z.object({
  personId: z.string().min(1, "Person ID is required"),
  consentType: z.enum(['explicit', 'implicit', 'legitimate_interest']),
  legalBasis: z.string().min(10, "Legal basis must be specified"),
  expiryDate: z.string().optional(),
});

type ConsentManagementForm = z.infer<typeof consentManagementSchema>;

export default function FacialRecognitionDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedEvent, setSelectedEvent] = useState<FacialRecognitionEvent | null>(null);
  const [addWatchlistOpen, setAddWatchlistOpen] = useState(false);
  const [consentDialogOpen, setConsentDialogOpen] = useState(false);

  // Fetch facial recognition statistics
  const { data: facialStats, isLoading: statsLoading } = useQuery<FacialRecognitionStats>({
    queryKey: ['/api/facial-recognition/stats', user?.storeId],
    enabled: !!user?.storeId,
  });

  // Fetch watchlist entries
  const { data: watchlistEntries, isLoading: watchlistLoading } = useQuery<WatchlistEntry[]>({
    queryKey: ['/api/facial-recognition/watchlist', user?.storeId],
    enabled: !!user?.storeId,
  });

  // Fetch recent facial recognition events
  const { data: recentEvents, isLoading: eventsLoading } = useQuery<FacialRecognitionEvent[]>({
    queryKey: ['/api/facial-recognition/events', user?.storeId],
    enabled: !!user?.storeId,
  });

  // Fetch consent records
  const { data: consentRecords, isLoading: consentLoading } = useQuery<ConsentRecord[]>({
    queryKey: ['/api/facial-recognition/consent', user?.storeId],
    enabled: !!user?.storeId,
  });

  // Mutations
  const addWatchlistMutation = useMutation({
    mutationFn: (data: WatchlistEntryForm) => 
      apiRequest('POST', '/api/facial-recognition/watchlist', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facial-recognition/watchlist'] });
      setAddWatchlistOpen(false);
      toast({
        title: "Watchlist Entry Added",
        description: "Person has been successfully added to the watchlist",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add watchlist entry",
        variant: "destructive",
      });
    },
  });

  const removeWatchlistMutation = useMutation({
    mutationFn: (entryId: string) => 
      apiRequest('DELETE', `/api/facial-recognition/watchlist/${entryId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facial-recognition/watchlist'] });
      toast({
        title: "Watchlist Entry Removed",
        description: "Person has been removed from the watchlist",
      });
    },
  });

  const consentManagementMutation = useMutation({
    mutationFn: (data: ConsentManagementForm) => 
      apiRequest('POST', '/api/privacy/consent', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/facial-recognition/consent'] });
      setConsentDialogOpen(false);
      toast({
        title: "Consent Updated",
        description: "Consent preferences have been updated successfully",
      });
    },
  });

  // Form handlers
  const watchlistForm = useForm<WatchlistEntryForm>({
    resolver: zodResolver(watchlistEntrySchema),
    defaultValues: {
      notifications: {
        email: true,
        sms: false,
        realtime: true,
      }
    }
  });

  const consentForm = useForm<ConsentManagementForm>({
    resolver: zodResolver(consentManagementSchema),
  });

  const onWatchlistSubmit = (data: WatchlistEntryForm) => {
    addWatchlistMutation.mutate(data);
  };

  const onConsentSubmit = (data: ConsentManagementForm) => {
    consentManagementMutation.mutate(data);
  };

  // Stats calculations
  const stats = {
    totalFaces: facialStats?.totalFacesDetected || 0,
    uniquePersons: facialStats?.uniquePersonsIdentified || 0,
    watchlistMatches: facialStats?.watchlistMatches || 0,
    consentCompliance: Math.round((facialStats?.consentCompliance || 0) * 100),
    avgConfidence: Math.round((facialStats?.averageConfidence || 0) * 100),
    totalEvents: facialStats?.totalEvents || 0,
  };

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      default: return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Facial Recognition Dashboard</h1>
          <p className="text-muted-foreground">Privacy-compliant facial recognition with GDPR controls</p>
          {user && <p className="text-sm text-muted-foreground">Store: {user.storeId}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-blue-600">
            <Brain className="w-4 h-4 mr-1" />
            AI Enhanced
          </Badge>
          <Badge variant="outline" className="text-green-600">
            <Lock className="w-4 h-4 mr-1" />
            GDPR Compliant
          </Badge>
        </div>
      </div>

      {/* Privacy Notice */}
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950">
        <Shield className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-700 dark:text-blue-300">
          <strong>Privacy Notice:</strong> This system processes biometric data in compliance with GDPR and CCPA. 
          All facial recognition requires explicit consent and uses encrypted template storage.
        </AlertDescription>
      </Alert>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card data-testid="card-faces-detected">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Faces Detected</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalFaces}</div>
            <p className="text-xs text-muted-foreground">Total detections</p>
          </CardContent>
        </Card>

        <Card data-testid="card-unique-persons">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Persons</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.uniquePersons}</div>
            <p className="text-xs text-muted-foreground">Identified individuals</p>
          </CardContent>
        </Card>

        <Card data-testid="card-watchlist-matches">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Watchlist Matches</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.watchlistMatches}</div>
            <p className="text-xs text-muted-foreground">Security alerts</p>
          </CardContent>
        </Card>

        <Card data-testid="card-consent-compliance">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Consent Compliance</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.consentCompliance}%</div>
            <p className="text-xs text-muted-foreground">GDPR compliance</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="watchlist" data-testid="tab-watchlist">Watchlist</TabsTrigger>
          <TabsTrigger value="events" data-testid="tab-events">Events</TabsTrigger>
          <TabsTrigger value="privacy" data-testid="tab-privacy">Privacy</TabsTrigger>
          <TabsTrigger value="compliance" data-testid="tab-compliance">Compliance</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recent Activity */}
            <Card data-testid="card-recent-activity">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  Recent Activity
                </CardTitle>
                <CardDescription>Latest facial recognition events</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  {eventsLoading ? (
                    <p className="text-sm text-muted-foreground">Loading events...</p>
                  ) : recentEvents && recentEvents.length > 0 ? (
                    <div className="space-y-3">
                      {recentEvents.slice(0, 5).map((event) => (
                        <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${event.faceAttributes.watchlistMatch ? 'bg-red-500' : 'bg-green-500'}`} />
                            <div>
                              <p className="text-sm font-medium">
                                {event.faceAttributes.watchlistMatch ? 'Watchlist Match' : 'Face Detected'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Camera {event.cameraId} • {event.faceAttributes.confidence.toFixed(2)} confidence
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-muted-foreground">
                              {new Date(event.detectionTimestamp).toLocaleTimeString()}
                            </p>
                            {event.faceAttributes.watchlistMatch && (
                              <Badge variant="destructive" className="text-xs">Alert</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No recent events</p>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* System Status */}
            <Card data-testid="card-system-status">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  System Status
                </CardTitle>
                <CardDescription>Facial recognition system health</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">AI Processing</span>
                  <Badge variant="outline" className="text-green-600">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Privacy Controls</span>
                  <Badge variant="outline" className="text-green-600">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Enabled
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Encryption</span>
                  <Badge variant="outline" className="text-green-600">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    AES-256-GCM
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Consent Verification</span>
                  <Badge variant="outline" className="text-green-600">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Active
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Average Confidence</span>
                  <Badge variant="outline">
                    {stats.avgConfidence}%
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Watchlist Tab */}
        <TabsContent value="watchlist" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Watchlist Management</h2>
              <p className="text-sm text-muted-foreground">Manage persons of interest with legal authorization</p>
            </div>
            <Dialog open={addWatchlistOpen} onOpenChange={setAddWatchlistOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-watchlist">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Entry
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Watchlist Entry</DialogTitle>
                  <DialogDescription>
                    Add a person to the watchlist with proper legal authorization
                  </DialogDescription>
                </DialogHeader>
                <Form {...watchlistForm}>
                  <form onSubmit={watchlistForm.handleSubmit(onWatchlistSubmit)} className="space-y-4">
                    <FormField
                      control={watchlistForm.control}
                      name="personId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Person ID</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter person identifier" {...field} data-testid="input-person-id" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={watchlistForm.control}
                      name="watchlistType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Watchlist Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-watchlist-type">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="security_threat">Security Threat</SelectItem>
                              <SelectItem value="banned_individual">Banned Individual</SelectItem>
                              <SelectItem value="person_of_interest">Person of Interest</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={watchlistForm.control}
                      name="riskLevel"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Risk Level</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-risk-level">
                                <SelectValue placeholder="Select risk level" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="low">Low</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="high">High</SelectItem>
                              <SelectItem value="critical">Critical</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={watchlistForm.control}
                      name="reason"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Reason</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Detailed reason for watchlist entry" {...field} data-testid="input-reason" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={watchlistForm.control}
                      name="legalAuthorization"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Legal Authorization (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Court order, warrant number, etc." {...field} data-testid="input-legal-auth" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setAddWatchlistOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={addWatchlistMutation.isPending} data-testid="button-submit-watchlist">
                        Add Entry
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <Card data-testid="card-watchlist-entries">
            <CardContent className="p-0">
              {watchlistLoading ? (
                <div className="p-4 text-center text-muted-foreground">Loading watchlist...</div>
              ) : watchlistEntries && watchlistEntries.length > 0 ? (
                <div className="divide-y">
                  {watchlistEntries.map((entry) => (
                    <div key={entry.id} className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`px-2 py-1 rounded-full text-xs font-medium ${getRiskLevelColor(entry.riskLevel)}`}>
                          {entry.riskLevel.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">Person ID: {entry.personId}</p>
                          <p className="text-sm text-muted-foreground">{entry.watchlistType.replace('_', ' ')}</p>
                          <p className="text-xs text-muted-foreground">{entry.reason}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => removeWatchlistMutation.mutate(entry.id)}
                          disabled={removeWatchlistMutation.isPending}
                          data-testid={`button-remove-${entry.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No watchlist entries yet</p>
                  <p className="text-sm">Add persons of interest to start monitoring</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Events Tab */}
        <TabsContent value="events" className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Facial Recognition Events</h2>
            <p className="text-sm text-muted-foreground">Real-time monitoring of facial recognition detections</p>
          </div>

          <Card data-testid="card-events-list">
            <CardContent className="p-0">
              {eventsLoading ? (
                <div className="p-4 text-center text-muted-foreground">Loading events...</div>
              ) : recentEvents && recentEvents.length > 0 ? (
                <ScrollArea className="h-96">
                  <div className="divide-y">
                    {recentEvents.map((event) => (
                      <div 
                        key={event.id} 
                        className="p-4 hover:bg-muted/50 cursor-pointer"
                        onClick={() => setSelectedEvent(event)}
                        data-testid={`event-${event.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${event.faceAttributes.watchlistMatch ? 'bg-red-500' : 'bg-green-500'}`} />
                            <div>
                              <p className="font-medium">
                                {event.faceAttributes.watchlistMatch ? 'Watchlist Match Detected' : 'Face Detected'}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Camera {event.cameraId} • Confidence: {(event.faceAttributes.confidence * 100).toFixed(1)}%
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Processing Time: {event.processingTimeMs}ms • Consent: {event.consentVerified ? 'Verified' : 'Not Verified'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm">{new Date(event.detectionTimestamp).toLocaleString()}</p>
                            {event.faceAttributes.watchlistMatch && (
                              <Badge variant="destructive">High Priority</Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  <Camera className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No facial recognition events yet</p>
                  <p className="text-sm">Events will appear here as faces are detected</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy Tab */}
        <TabsContent value="privacy" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Privacy Controls</h2>
              <p className="text-sm text-muted-foreground">GDPR compliance and data subject rights management</p>
            </div>
            <Dialog open={consentDialogOpen} onOpenChange={setConsentDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-manage-consent">
                  <UserCheck className="w-4 h-4 mr-2" />
                  Manage Consent
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Consent Management</DialogTitle>
                  <DialogDescription>
                    Manage facial recognition consent for individuals
                  </DialogDescription>
                </DialogHeader>
                <Form {...consentForm}>
                  <form onSubmit={consentForm.handleSubmit(onConsentSubmit)} className="space-y-4">
                    <FormField
                      control={consentForm.control}
                      name="personId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Person ID</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter person identifier" {...field} data-testid="input-consent-person-id" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={consentForm.control}
                      name="consentType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Consent Type</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-consent-type">
                                <SelectValue placeholder="Select consent type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="explicit">Explicit Consent</SelectItem>
                              <SelectItem value="legitimate_interest">Legitimate Interest</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={consentForm.control}
                      name="legalBasis"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Legal Basis</FormLabel>
                          <FormControl>
                            <Textarea placeholder="GDPR Article 6 legal basis for processing" {...field} data-testid="input-legal-basis" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setConsentDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={consentManagementMutation.isPending} data-testid="button-submit-consent">
                        Update Consent
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Consent Status */}
            <Card data-testid="card-consent-status">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="w-5 h-5" />
                  Consent Status
                </CardTitle>
                <CardDescription>Current consent records for facial recognition</CardDescription>
              </CardHeader>
              <CardContent>
                {consentLoading ? (
                  <p className="text-sm text-muted-foreground">Loading consent records...</p>
                ) : consentRecords && consentRecords.length > 0 ? (
                  <ScrollArea className="h-64">
                    <div className="space-y-3">
                      {consentRecords.map((consent) => (
                        <div key={consent.id} className="flex items-center justify-between p-3 border rounded-lg">
                          <div>
                            <p className="font-medium">Person: {consent.personId}</p>
                            <p className="text-sm text-muted-foreground">
                              {consent.consentType} • {consent.consentGiven ? 'Granted' : 'Withdrawn'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {consent.consentGiven ? (
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            ) : (
                              <XCircle className="w-5 h-5 text-red-600" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                ) : (
                  <p className="text-sm text-muted-foreground">No consent records found</p>
                )}
              </CardContent>
            </Card>

            {/* Data Subject Rights */}
            <Card data-testid="card-data-rights">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Data Subject Rights
                </CardTitle>
                <CardDescription>GDPR compliance tools</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start" data-testid="button-data-access">
                  <Download className="w-4 h-4 mr-2" />
                  Generate Data Subject Access Report
                </Button>
                <Button variant="outline" className="w-full justify-start" data-testid="button-right-erasure">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Process Right to Erasure Request
                </Button>
                <Button variant="outline" className="w-full justify-start" data-testid="button-consent-withdrawal">
                  <UserX className="w-4 h-4 mr-2" />
                  Withdraw Consent
                </Button>
                <Button variant="outline" className="w-full justify-start" data-testid="button-restrict-processing">
                  <Lock className="w-4 h-4 mr-2" />
                  Restrict Processing
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Compliance Tab */}
        <TabsContent value="compliance" className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Compliance Reporting</h2>
            <p className="text-sm text-muted-foreground">Audit trails and regulatory compliance reports</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Audit Statistics */}
            <Card data-testid="card-audit-stats">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Audit Statistics
                </CardTitle>
                <CardDescription>Compliance metrics and audit trail summary</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Total Events Logged</span>
                  <Badge variant="outline">{stats.totalEvents}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Consent Compliance Rate</span>
                  <Badge variant={stats.consentCompliance >= 95 ? "outline" : "destructive"}>
                    {stats.consentCompliance}%
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Watchlist Alerts</span>
                  <Badge variant="outline">{stats.watchlistMatches}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Average Processing Time</span>
                  <Badge variant="outline">
                    {recentEvents && recentEvents.length > 0 
                      ? Math.round(recentEvents.reduce((sum, e) => sum + e.processingTimeMs, 0) / recentEvents.length)
                      : 0}ms
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Compliance Reports */}
            <Card data-testid="card-compliance-reports">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Compliance Reports
                </CardTitle>
                <CardDescription>Generate regulatory compliance reports</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start" data-testid="button-gdpr-report">
                  <Download className="w-4 h-4 mr-2" />
                  GDPR Compliance Report
                </Button>
                <Button variant="outline" className="w-full justify-start" data-testid="button-audit-trail">
                  <FileText className="w-4 h-4 mr-2" />
                  Facial Recognition Audit Trail
                </Button>
                <Button variant="outline" className="w-full justify-start" data-testid="button-consent-audit">
                  <UserCheck className="w-4 h-4 mr-2" />
                  Consent Management Audit
                </Button>
                <Button variant="outline" className="w-full justify-start" data-testid="button-privacy-impact">
                  <Shield className="w-4 h-4 mr-2" />
                  Privacy Impact Assessment
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Event Detail Dialog */}
      {selectedEvent && (
        <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Facial Recognition Event Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-medium">Event ID</p>
                  <p className="text-muted-foreground">{selectedEvent.id}</p>
                </div>
                <div>
                  <p className="font-medium">Camera</p>
                  <p className="text-muted-foreground">{selectedEvent.cameraId}</p>
                </div>
                <div>
                  <p className="font-medium">Detection Time</p>
                  <p className="text-muted-foreground">{new Date(selectedEvent.detectionTimestamp).toLocaleString()}</p>
                </div>
                <div>
                  <p className="font-medium">Confidence</p>
                  <p className="text-muted-foreground">{(selectedEvent.faceAttributes.confidence * 100).toFixed(1)}%</p>
                </div>
                <div>
                  <p className="font-medium">Watchlist Match</p>
                  <Badge variant={selectedEvent.faceAttributes.watchlistMatch ? "destructive" : "outline"}>
                    {selectedEvent.faceAttributes.watchlistMatch ? "Yes" : "No"}
                  </Badge>
                </div>
                <div>
                  <p className="font-medium">Consent Verified</p>
                  <Badge variant={selectedEvent.consentVerified ? "outline" : "destructive"}>
                    {selectedEvent.consentVerified ? "Yes" : "No"}
                  </Badge>
                </div>
                <div>
                  <p className="font-medium">Processing Time</p>
                  <p className="text-muted-foreground">{selectedEvent.processingTimeMs}ms</p>
                </div>
                {selectedEvent.faceAttributes.personId && (
                  <div>
                    <p className="font-medium">Person ID</p>
                    <p className="text-muted-foreground">{selectedEvent.faceAttributes.personId}</p>
                  </div>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
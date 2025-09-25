import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Settings, Bell, Shield, Users, Database, Camera, Plus, Edit, Trash2, TestTube, Wifi, WifiOff, AlertTriangle, CheckCircle, Loader2, Play, Pause } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import type { Camera as CameraType } from "@shared/schema";
import { SecurityNavigation } from "@/components/SecurityNavigation";

// Camera form schema for validation
const cameraFormSchema = z.object({
  name: z.string().min(1, "Camera name is required").max(50, "Name must be under 50 characters"),
  location: z.string().min(1, "Location is required").max(100, "Location must be under 100 characters"),
  protocol: z.enum(["rtsp", "webrtc", "mjpeg", "websocket", "hls"], {
    required_error: "Protocol is required",
  }),
  streamUrl: z.string().url("Must be a valid URL").min(1, "Stream URL is required"),
  username: z.string().optional(),
  password: z.string().optional(),
  resolution: z.enum(["720p", "1080p", "4K"]).default("1080p"),
  quality: z.enum(["low", "medium", "high", "ultra"]).default("medium"),
  enableRecording: z.boolean().default(false),
  enableAI: z.boolean().default(true)
});

type CameraFormData = z.infer<typeof cameraFormSchema>;

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedCamera, setSelectedCamera] = useState<CameraType | null>(null);
  const [isAddCameraOpen, setIsAddCameraOpen] = useState(false);
  const [isEditCameraOpen, setIsEditCameraOpen] = useState(false);
  const [testingCameraId, setTestingCameraId] = useState<string | null>(null);

  const [notifications, setNotifications] = useState({
    emailAlerts: true,
    smsAlerts: false,
    pushNotifications: true,
    weeklyReports: true
  });

  const [security, setSecurity] = useState({
    autoLockout: true,
    twoFactorAuth: false,
    sessionTimeout: "30"
  });

  const [detection, setDetection] = useState({
    sensitivity: "medium",
    faceRecognition: true,
    behaviorAnalysis: true,
    objectDetection: true
  });

  // Camera queries and mutations
  const { data: cameras = [], isLoading: camerasLoading, refetch: refetchCameras } = useQuery({
    queryKey: ['/api/store/default/cameras'], // Using 'default' store for demo
    enabled: !!user
  });

  const createCameraMutation = useMutation({
    mutationFn: async (data: CameraFormData) => {
      return apiRequest('POST', '/api/store/default/cameras', {
        ...data,
        storeId: 'default',
        streamConfig: {
          [data.protocol]: {
            url: data.streamUrl,
            auth: data.username && data.password ? {
              username: data.username,
              password: data.password
            } : undefined,
            resolution: data.resolution,
            quality: data.quality
          }
        },
        authConfig: data.username && data.password ? {
          type: 'basic',
          username: data.username,
          password: data.password
        } : undefined
      });
    },
    onSuccess: () => {
      toast({ title: "Camera added successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/store/default/cameras'] });
      setIsAddCameraOpen(false);
    },
    onError: (error: any) => {
      toast({ title: "Error adding camera", description: error.message, variant: "destructive" });
    }
  });

  const updateCameraMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CameraFormData> }) => {
      return apiRequest('PUT', `/api/cameras/${id}`, {
        ...data,
        streamConfig: data.protocol && data.streamUrl ? {
          [data.protocol]: {
            url: data.streamUrl,
            auth: data.username && data.password ? {
              username: data.username,
              password: data.password
            } : undefined,
            resolution: data.resolution,
            quality: data.quality
          }
        } : undefined
      });
    },
    onSuccess: () => {
      toast({ title: "Camera updated successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/store/default/cameras'] });
      setIsEditCameraOpen(false);
      setSelectedCamera(null);
    },
    onError: (error: any) => {
      toast({ title: "Error updating camera", description: error.message, variant: "destructive" });
    }
  });

  const deleteCameraMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/cameras/${id}`);
    },
    onSuccess: () => {
      toast({ title: "Camera deleted successfully" });
      queryClient.invalidateQueries({ queryKey: ['/api/store/default/cameras'] });
    },
    onError: (error: any) => {
      toast({ title: "Error deleting camera", description: error.message, variant: "destructive" });
    }
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (cameraId: string) => {
      return apiRequest('POST', `/api/cameras/${cameraId}/test-connection`);
    },
    onSuccess: (data: any) => {
      toast({ 
        title: data.success ? "Connection successful" : "Connection failed",
        description: data.error || `Latency: ${data.latency}ms, Quality: ${data.quality}`,
        variant: data.success ? "default" : "destructive"
      });
      setTestingCameraId(null);
    },
    onError: (error: any) => {
      toast({ title: "Connection test failed", description: error.message, variant: "destructive" });
      setTestingCameraId(null);
    }
  });

  return (
    <>
      <SecurityNavigation />
      <div className="pl-64 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Settings</h1>
          <p className="text-muted-foreground">Manage your security system preferences</p>
        </div>
        <Settings className="h-8 w-8 text-muted-foreground" />
      </div>

      {/* Settings Tabs */}
      <Tabs defaultValue="notifications" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="detection">Detection</TabsTrigger>
          <TabsTrigger value="cameras">Cameras</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-6">
          <Card data-testid="card-notification-settings">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notification Preferences
              </CardTitle>
              <CardDescription>
                Configure how you receive security alerts and updates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Email Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive security alerts via email
                  </p>
                </div>
                <Switch
                  checked={notifications.emailAlerts}
                  onCheckedChange={(checked) => 
                    setNotifications({...notifications, emailAlerts: checked})
                  }
                  data-testid="switch-email-alerts"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>SMS Alerts</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive critical alerts via SMS
                  </p>
                </div>
                <Switch
                  checked={notifications.smsAlerts}
                  onCheckedChange={(checked) => 
                    setNotifications({...notifications, smsAlerts: checked})
                  }
                  data-testid="switch-sms-alerts"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Show browser notifications for alerts
                  </p>
                </div>
                <Switch
                  checked={notifications.pushNotifications}
                  onCheckedChange={(checked) => 
                    setNotifications({...notifications, pushNotifications: checked})
                  }
                  data-testid="switch-push-notifications"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Weekly Reports</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive weekly security summary reports
                  </p>
                </div>
                <Switch
                  checked={notifications.weeklyReports}
                  onCheckedChange={(checked) => 
                    setNotifications({...notifications, weeklyReports: checked})
                  }
                  data-testid="switch-weekly-reports"
                />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="alert-email">Alert Email Address</Label>
                  <Input
                    id="alert-email"
                    placeholder="alerts@yourdomain.com"
                    data-testid="input-alert-email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="alert-phone">Alert Phone Number</Label>
                  <Input
                    id="alert-phone"
                    placeholder="+1 (555) 123-4567"
                    data-testid="input-alert-phone"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card data-testid="card-security-settings">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Settings
              </CardTitle>
              <CardDescription>
                Configure account security and access controls
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto Lockout</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically lock account after failed login attempts
                  </p>
                </div>
                <Switch
                  checked={security.autoLockout}
                  onCheckedChange={(checked) => 
                    setSecurity({...security, autoLockout: checked})
                  }
                  data-testid="switch-auto-lockout"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Two-Factor Authentication</Label>
                  <p className="text-sm text-muted-foreground">
                    Add an extra layer of security to your account
                  </p>
                </div>
                <Switch
                  checked={security.twoFactorAuth}
                  onCheckedChange={(checked) => 
                    setSecurity({...security, twoFactorAuth: checked})
                  }
                  data-testid="switch-2fa"
                />
              </div>

              <Separator />

              <div className="space-y-2">
                <Label>Session Timeout (minutes)</Label>
                <Select 
                  value={security.sessionTimeout} 
                  onValueChange={(value) => 
                    setSecurity({...security, sessionTimeout: value})
                  }
                >
                  <SelectTrigger data-testid="select-session-timeout">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                    <SelectItem value="480">8 hours</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-sm text-muted-foreground">
                  How long to keep you logged in when inactive
                </p>
              </div>

              <div className="space-y-4">
                <Button data-testid="button-change-password">Change Password</Button>
                <Button variant="outline" data-testid="button-download-backup">
                  Download Security Backup
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="detection" className="space-y-6">
          <Card data-testid="card-detection-settings">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Camera className="h-5 w-5" />
                Detection Settings
              </CardTitle>
              <CardDescription>
                Configure AI detection sensitivity and features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Detection Sensitivity</Label>
                <Select 
                  value={detection.sensitivity} 
                  onValueChange={(value) => 
                    setDetection({...detection, sensitivity: value})
                  }
                >
                  <SelectTrigger data-testid="select-sensitivity">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - Fewer alerts, less sensitive</SelectItem>
                    <SelectItem value="medium">Medium - Balanced detection</SelectItem>
                    <SelectItem value="high">High - More alerts, very sensitive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Face Recognition</Label>
                  <p className="text-sm text-muted-foreground">
                    Identify known offenders from database
                  </p>
                </div>
                <Switch
                  checked={detection.faceRecognition}
                  onCheckedChange={(checked) => 
                    setDetection({...detection, faceRecognition: checked})
                  }
                  data-testid="switch-face-recognition"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Behavior Analysis</Label>
                  <p className="text-sm text-muted-foreground">
                    Detect suspicious behavior patterns
                  </p>
                </div>
                <Switch
                  checked={detection.behaviorAnalysis}
                  onCheckedChange={(checked) => 
                    setDetection({...detection, behaviorAnalysis: checked})
                  }
                  data-testid="switch-behavior-analysis"
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Object Detection</Label>
                  <p className="text-sm text-muted-foreground">
                    Detect concealed items and suspicious objects
                  </p>
                </div>
                <Switch
                  checked={detection.objectDetection}
                  onCheckedChange={(checked) => 
                    setDetection({...detection, objectDetection: checked})
                  }
                  data-testid="switch-object-detection"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cameras" className="space-y-6">
          <Card data-testid="card-camera-management">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  Camera Management
                </div>
                <Dialog open={isAddCameraOpen} onOpenChange={setIsAddCameraOpen}>
                  <DialogTrigger asChild>
                    <Button data-testid="button-add-camera">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Camera
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Add New Camera</DialogTitle>
                      <DialogDescription>
                        Configure your camera connection settings and stream options
                      </DialogDescription>
                    </DialogHeader>
                    <CameraForm 
                      onSubmit={(data) => createCameraMutation.mutate(data)}
                      isLoading={createCameraMutation.isPending}
                    />
                  </DialogContent>
                </Dialog>
              </CardTitle>
              <CardDescription>
                Manage your security cameras and their streaming configurations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {camerasLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <span className="ml-2">Loading cameras...</span>
                </div>
              ) : cameras.length === 0 ? (
                <div className="text-center p-8">
                  <Camera className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No cameras configured</h3>
                  <p className="text-muted-foreground mb-4">
                    Add your first camera to start monitoring your security system
                  </p>
                  <Button onClick={() => setIsAddCameraOpen(true)} data-testid="button-add-first-camera">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Camera
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {cameras.map((camera: CameraType) => (
                    <div key={camera.id} className="border rounded-lg p-4 space-y-3" data-testid={`card-camera-${camera.id}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <Camera className="h-8 w-8 text-primary" />
                            <div className={`absolute -top-1 -right-1 h-3 w-3 rounded-full border-2 border-white ${
                              camera.status === 'online' ? 'bg-green-500' :
                              camera.status === 'offline' ? 'bg-red-500' :
                              camera.status === 'maintenance' ? 'bg-yellow-500' :
                              'bg-gray-500'
                            }`} />
                          </div>
                          <div>
                            <h4 className="font-semibold" data-testid={`text-camera-name-${camera.id}`}>
                              {camera.name}
                            </h4>
                            <p className="text-sm text-muted-foreground" data-testid={`text-camera-location-${camera.id}`}>
                              {camera.location}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={camera.status === 'online' ? 'default' : 'secondary'}
                            data-testid={`badge-camera-status-${camera.id}`}
                          >
                            {camera.status === 'online' ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
                            {camera.status}
                          </Badge>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setTestingCameraId(camera.id);
                              testConnectionMutation.mutate(camera.id);
                            }}
                            disabled={testingCameraId === camera.id}
                            data-testid={`button-test-camera-${camera.id}`}
                          >
                            {testingCameraId === camera.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <TestTube className="h-4 w-4" />
                            )}
                            Test
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedCamera(camera);
                              setIsEditCameraOpen(true);
                            }}
                            data-testid={`button-edit-camera-${camera.id}`}
                          >
                            <Edit className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteCameraMutation.mutate(camera.id)}
                            disabled={deleteCameraMutation.isPending}
                            data-testid={`button-delete-camera-${camera.id}`}
                          >
                            {deleteCameraMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Delete
                          </Button>
                        </div>
                      </div>
                      
                      <Separator />
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Protocol:</span>
                          <p className="font-medium">
                            {Object.keys((camera.streamConfig as any) || {})[0]?.toUpperCase() || 'Unknown'}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Resolution:</span>
                          <p className="font-medium">
                            {((camera.streamConfig as any)?.[Object.keys((camera.streamConfig as any) || {})[0]]?.resolution) || 'Unknown'}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Quality:</span>
                          <p className="font-medium">
                            {((camera.streamConfig as any)?.[Object.keys((camera.streamConfig as any) || {})[0]]?.quality) || 'Unknown'}
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Last Seen:</span>
                          <p className="font-medium">
                            {camera.lastHeartbeat ? new Date(camera.lastHeartbeat).toLocaleString() : 'Never'}
                          </p>
                        </div>
                      </div>
                      
                      {(camera.connectionStatus as any)?.quality && (
                        <div className="bg-muted/50 rounded-lg p-3">
                          <h5 className="font-medium mb-2">Stream Quality Metrics</h5>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Latency:</span>
                              <p className="font-medium">
                                {(camera.connectionStatus as any).quality.latency || 0}ms
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Frame Rate:</span>
                              <p className="font-medium">
                                {(camera.connectionStatus as any).quality.frameRate || 0} fps
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Signal:</span>
                              <p className="font-medium">
                                {(camera.connectionStatus as any).quality.signalStrength || 0}%
                              </p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">AI Analysis:</span>
                              <Badge variant={camera.enableAI ? 'default' : 'secondary'}>
                                {camera.enableAI ? 'Enabled' : 'Disabled'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Camera Health Overview */}
          <Card data-testid="card-camera-health">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Camera Health Overview
              </CardTitle>
              <CardDescription>
                Monitor the overall health and status of your camera network
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-600">
                    {cameras.filter((c: CameraType) => c.status === 'online').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Online</p>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <WifiOff className="h-8 w-8 text-red-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-red-600">
                    {cameras.filter((c: CameraType) => c.status === 'offline').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Offline</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <AlertTriangle className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-yellow-600">
                    {cameras.filter((c: CameraType) => c.status === 'maintenance').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Maintenance</p>
                </div>
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Camera className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-blue-600">{cameras.length}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Edit Camera Dialog */}
          <Dialog open={isEditCameraOpen} onOpenChange={setIsEditCameraOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Edit Camera</DialogTitle>
                <DialogDescription>
                  Update camera settings and stream configuration
                </DialogDescription>
              </DialogHeader>
              {selectedCamera && (
                <CameraForm 
                  camera={selectedCamera}
                  onSubmit={(data) => updateCameraMutation.mutate({ id: selectedCamera.id, data })}
                  isLoading={updateCameraMutation.isPending}
                />
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card data-testid="card-user-management">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                User Management
              </CardTitle>
              <CardDescription>
                Manage user accounts and permissions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span>Active Users</span>
                <span className="font-medium">5 users</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Store Staff</span>
                <span className="font-medium">3 users</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Store Admins</span>
                <span className="font-medium">2 users</span>
              </div>
              <Separator />
              <div className="space-y-4">
                <Button data-testid="button-invite-user">Invite New User</Button>
                <Button variant="outline" data-testid="button-manage-roles">
                  Manage Roles & Permissions
                </Button>
                <Button variant="outline" data-testid="button-view-audit-log">
                  View User Activity Log
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="space-y-6">
          <Card data-testid="card-system-settings">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                System Settings
              </CardTitle>
              <CardDescription>
                System maintenance and data management
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>Storage Used</span>
                  <span className="font-medium">67% of 1TB</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Video Retention</span>
                  <span className="font-medium">30 days</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Last Backup</span>
                  <span className="font-medium">2 hours ago</span>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="retention-period">Video Retention Period (days)</Label>
                <Input
                  id="retention-period"
                  defaultValue="30"
                  data-testid="input-retention-period"
                />
                <p className="text-sm text-muted-foreground">
                  How long to keep video recordings before deletion
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="system-notes">System Notes</Label>
                <Textarea
                  id="system-notes"
                  placeholder="Add any system notes or maintenance reminders..."
                  data-testid="textarea-system-notes"
                />
              </div>

              <div className="space-y-4">
                <Button data-testid="button-backup-now">Backup System Now</Button>
                <Button variant="outline" data-testid="button-system-diagnostics">
                  Run System Diagnostics
                </Button>
                <Button variant="outline" data-testid="button-export-logs">
                  Export System Logs
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button size="lg" data-testid="button-save-settings">
          Save All Settings
        </Button>
      </div>
      </div>
    </>
  );
}

// Camera Form Component
function CameraForm({ 
  camera, 
  onSubmit, 
  isLoading 
}: { 
  camera?: CameraType; 
  onSubmit: (data: CameraFormData) => void; 
  isLoading: boolean;
}) {
  const form = useForm<CameraFormData>({
    resolver: zodResolver(cameraFormSchema),
    defaultValues: {
      name: camera?.name || "",
      location: camera?.location || "",
      protocol: (camera?.streamConfig && Object.keys(camera.streamConfig)[0] as any) || "rtsp",
      streamUrl: (camera?.streamConfig && 
        (camera.streamConfig as any)[Object.keys(camera.streamConfig)[0]]?.url) || "",
      username: (camera?.authConfig as any)?.username || "",
      password: (camera?.authConfig as any)?.password || "",
      resolution: (camera?.streamConfig && 
        (camera.streamConfig as any)[Object.keys(camera.streamConfig)[0]]?.resolution) || "1080p",
      quality: (camera?.streamConfig && 
        (camera.streamConfig as any)[Object.keys(camera.streamConfig)[0]]?.quality) || "medium",
      enableRecording: camera?.enableRecording || false,
      enableAI: camera?.enableAI !== false
    }
  });

  const selectedProtocol = form.watch("protocol");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Camera Name *</FormLabel>
                <FormControl>
                  <Input 
                    {...field} 
                    placeholder="Front Door Camera"
                    data-testid="input-camera-name"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Location *</FormLabel>
                <FormControl>
                  <Input 
                    {...field} 
                    placeholder="Main Entrance"
                    data-testid="input-camera-location"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="protocol"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stream Protocol *</FormLabel>
                <FormControl>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger data-testid="select-camera-protocol">
                      <SelectValue placeholder="Select protocol" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rtsp">RTSP - IP Security Cameras</SelectItem>
                      <SelectItem value="webrtc">WebRTC - Low Latency Streaming</SelectItem>
                      <SelectItem value="mjpeg">MJPEG - Basic HTTP Streaming</SelectItem>
                      <SelectItem value="websocket">WebSocket - Custom Integration</SelectItem>
                      <SelectItem value="hls">HLS - HTTP Live Streaming</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="streamUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stream URL *</FormLabel>
                <FormControl>
                  <Input 
                    {...field} 
                    placeholder={
                      selectedProtocol === 'rtsp' ? 'rtsp://192.168.1.100:554/stream' :
                      selectedProtocol === 'mjpeg' ? 'http://192.168.1.100/mjpeg/video.cgi' :
                      selectedProtocol === 'websocket' ? 'ws://192.168.1.100:8080/stream' :
                      selectedProtocol === 'hls' ? 'http://192.168.1.100/stream.m3u8' :
                      'Enter stream URL'
                    }
                    data-testid="input-camera-url"
                  />
                </FormControl>
                <FormDescription>
                  {selectedProtocol === 'rtsp' && 'RTSP URL format: rtsp://[username:password@]host[:port]/path'}
                  {selectedProtocol === 'mjpeg' && 'HTTP MJPEG URL format: http://[username:password@]host/path'}
                  {selectedProtocol === 'websocket' && 'WebSocket URL format: ws://host:port/path'}
                  {selectedProtocol === 'hls' && 'HLS URL format: http://host/playlist.m3u8'}
                  {selectedProtocol === 'webrtc' && 'WebRTC signaling server URL'}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username (Optional)</FormLabel>
                <FormControl>
                  <Input 
                    {...field} 
                    placeholder="Authentication username"
                    data-testid="input-camera-username"
                  />
                </FormControl>
                <FormDescription>
                  Leave empty if camera doesn't require authentication
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password (Optional)</FormLabel>
                <FormControl>
                  <Input 
                    {...field} 
                    type="password"
                    placeholder="Authentication password"
                    data-testid="input-camera-password"
                  />
                </FormControl>
                <FormDescription>
                  Leave empty if camera doesn't require authentication
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="resolution"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Resolution</FormLabel>
                <FormControl>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger data-testid="select-camera-resolution">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="720p">720p (1280x720)</SelectItem>
                      <SelectItem value="1080p">1080p (1920x1080)</SelectItem>
                      <SelectItem value="4K">4K (3840x2160)</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="quality"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stream Quality</FormLabel>
                <FormControl>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger data-testid="select-camera-quality">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low - Lower bandwidth</SelectItem>
                      <SelectItem value="medium">Medium - Balanced</SelectItem>
                      <SelectItem value="high">High - Better quality</SelectItem>
                      <SelectItem value="ultra">Ultra - Highest quality</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            control={form.control}
            name="enableRecording"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Enable Recording</FormLabel>
                  <FormDescription>
                    Automatically record camera streams for playback
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="switch-camera-recording"
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="enableAI"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Enable AI Analysis</FormLabel>
                  <FormDescription>
                    Apply AI detection and behavior analysis to this camera
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="switch-camera-ai"
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => form.reset()}
            disabled={isLoading}
            data-testid="button-camera-reset"
          >
            Reset
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            data-testid="button-camera-submit"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {camera ? 'Update Camera' : 'Add Camera'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
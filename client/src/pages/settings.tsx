import { Layout } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { 
  Settings as SettingsIcon, 
  User, 
  Shield, 
  Camera, 
  Bell, 
  Network, 
  Database, 
  Lock,
  AlertTriangle,
  Save,
  RotateCcw
} from "lucide-react";

export default function Settings() {
  return (
    <Layout>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="System Settings"
          subtitle="Configure your PENNY security system preferences"
          alertCount={0}
          networkStatus="active"
        />

        <div className="flex-1 overflow-auto p-6">
          <Tabs defaultValue="general" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="general" data-testid="tab-general">
                <SettingsIcon className="h-4 w-4 mr-2" />
                General
              </TabsTrigger>
              <TabsTrigger value="security" data-testid="tab-security">
                <Shield className="h-4 w-4 mr-2" />
                Security
              </TabsTrigger>
              <TabsTrigger value="cameras" data-testid="tab-cameras">
                <Camera className="h-4 w-4 mr-2" />
                Cameras
              </TabsTrigger>
              <TabsTrigger value="notifications" data-testid="tab-notifications">
                <Bell className="h-4 w-4 mr-2" />
                Alerts
              </TabsTrigger>
              <TabsTrigger value="network" data-testid="tab-network">
                <Network className="h-4 w-4 mr-2" />
                Network
              </TabsTrigger>
              <TabsTrigger value="user" data-testid="tab-user">
                <User className="h-4 w-4 mr-2" />
                Account
              </TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Store Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="store-name">Store Name</Label>
                      <Input id="store-name" defaultValue="Downtown Location" data-testid="input-store-name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="store-id">Store ID</Label>
                      <Input id="store-id" defaultValue="STORE-001" disabled data-testid="input-store-id" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="store-address">Address</Label>
                    <Textarea 
                      id="store-address" 
                      defaultValue="123 Main Street, Downtown, NY 10001"
                      data-testid="textarea-store-address"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="manager-name">Store Manager</Label>
                      <Input id="manager-name" defaultValue="John Smith" data-testid="input-manager-name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contact-phone">Contact Phone</Label>
                      <Input id="contact-phone" defaultValue="+1 (555) 123-4567" data-testid="input-contact-phone" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Dark Mode</Label>
                      <p className="text-sm text-muted-foreground">Use dark theme for the interface</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-dark-mode" />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto-refresh Data</Label>
                      <p className="text-sm text-muted-foreground">Automatically refresh dashboard data</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-auto-refresh" />
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <Label htmlFor="refresh-interval">Refresh Interval (seconds)</Label>
                    <Select defaultValue="30">
                      <SelectTrigger data-testid="select-refresh-interval">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 seconds</SelectItem>
                        <SelectItem value="30">30 seconds</SelectItem>
                        <SelectItem value="60">1 minute</SelectItem>
                        <SelectItem value="300">5 minutes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Detection Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Object Detection</Label>
                      <p className="text-sm text-muted-foreground">Enable AI-powered object detection</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-object-detection" />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Gait Analysis</Label>
                      <p className="text-sm text-muted-foreground">Analyze walking patterns for behavior detection</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-gait-analysis" />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Facial Recognition</Label>
                      <p className="text-sm text-muted-foreground">Enable facial recognition for known offenders</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-facial-recognition" />
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <Label htmlFor="confidence-threshold">Detection Confidence Threshold</Label>
                    <div className="flex items-center space-x-2">
                      <Input 
                        id="confidence-threshold" 
                        type="range" 
                        min="0" 
                        max="100" 
                        defaultValue="85"
                        className="flex-1"
                        data-testid="slider-confidence-threshold"
                      />
                      <span className="text-sm font-medium w-12">85%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Access Control</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Two-Factor Authentication</Label>
                      <p className="text-sm text-muted-foreground">Require 2FA for system access</p>
                    </div>
                    <Switch data-testid="switch-2fa" />
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                    <Select defaultValue="60">
                      <SelectTrigger data-testid="select-session-timeout">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 minutes</SelectItem>
                        <SelectItem value="30">30 minutes</SelectItem>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="240">4 hours</SelectItem>
                        <SelectItem value="480">8 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cameras" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Camera Configuration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="video-quality">Video Quality</Label>
                      <Select defaultValue="1080p">
                        <SelectTrigger data-testid="select-video-quality">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="720p">720p (HD)</SelectItem>
                          <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                          <SelectItem value="4k">4K (Ultra HD)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="frame-rate">Frame Rate</Label>
                      <Select defaultValue="30">
                        <SelectTrigger data-testid="select-frame-rate">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 FPS</SelectItem>
                          <SelectItem value="30">30 FPS</SelectItem>
                          <SelectItem value="60">60 FPS</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Night Vision</Label>
                      <p className="text-sm text-muted-foreground">Enable infrared night vision mode</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-night-vision" />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Motion Detection</Label>
                      <p className="text-sm text-muted-foreground">Trigger recording on motion detection</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-motion-detection" />
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <Label htmlFor="storage-duration">Recording Storage Duration</Label>
                    <Select defaultValue="30">
                      <SelectTrigger data-testid="select-storage-duration">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 days</SelectItem>
                        <SelectItem value="14">14 days</SelectItem>
                        <SelectItem value="30">30 days</SelectItem>
                        <SelectItem value="90">90 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Camera Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { name: 'Camera 01 - Entrance', status: 'online', lastSeen: '2 min ago' },
                      { name: 'Camera 02 - Aisle 3', status: 'online', lastSeen: '1 min ago' },
                      { name: 'Camera 03 - Checkout', status: 'maintenance', lastSeen: '1 hour ago' },
                      { name: 'Camera 04 - Storage', status: 'online', lastSeen: '30 sec ago' },
                      { name: 'Camera 05 - Exit', status: 'offline', lastSeen: '3 hours ago' },
                      { name: 'Camera 06 - Parking', status: 'online', lastSeen: '45 sec ago' },
                    ].map((camera, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div>
                          <p className="font-medium">{camera.name}</p>
                          <p className="text-sm text-muted-foreground">Last seen: {camera.lastSeen}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge 
                            variant={camera.status === 'online' ? 'default' : camera.status === 'maintenance' ? 'secondary' : 'destructive'}
                          >
                            {camera.status}
                          </Badge>
                          <Button variant="outline" size="sm" data-testid={`button-configure-camera-${index}`}>
                            Configure
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Alert Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Theft Detection Alerts</Label>
                      <p className="text-sm text-muted-foreground">Receive alerts when theft is detected</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-theft-alerts" />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Known Offender Alerts</Label>
                      <p className="text-sm text-muted-foreground">Alert when known offenders enter</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-offender-alerts" />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>System Status Alerts</Label>
                      <p className="text-sm text-muted-foreground">Notifications for system issues</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-system-alerts" />
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <Label htmlFor="alert-threshold">Alert Severity Threshold</Label>
                    <Select defaultValue="medium">
                      <SelectTrigger data-testid="select-alert-threshold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low and above</SelectItem>
                        <SelectItem value="medium">Medium and above</SelectItem>
                        <SelectItem value="high">High and above</SelectItem>
                        <SelectItem value="critical">Critical only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Notification Channels</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-notifications">Email Address</Label>
                    <Input 
                      id="email-notifications" 
                      type="email" 
                      defaultValue="manager@store.com"
                      data-testid="input-email-notifications"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="sms-notifications">SMS Number</Label>
                    <Input 
                      id="sms-notifications" 
                      type="tel" 
                      defaultValue="+1 (555) 123-4567"
                      data-testid="input-sms-notifications"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Push Notifications</Label>
                      <p className="text-sm text-muted-foreground">Browser push notifications</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-push-notifications" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="network" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Network Intelligence Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Cross-Store Intelligence Sharing</Label>
                      <p className="text-sm text-muted-foreground">Share offender data with network stores</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-intelligence-sharing" />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Automatic Offender Matching</Label>
                      <p className="text-sm text-muted-foreground">Auto-match offenders across stores</p>
                    </div>
                    <Switch defaultChecked data-testid="switch-auto-matching" />
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <Label htmlFor="sharing-radius">Intelligence Sharing Radius (miles)</Label>
                    <Select defaultValue="25">
                      <SelectTrigger data-testid="select-sharing-radius">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 miles</SelectItem>
                        <SelectItem value="10">10 miles</SelectItem>
                        <SelectItem value="25">25 miles</SelectItem>
                        <SelectItem value="50">50 miles</SelectItem>
                        <SelectItem value="unlimited">Unlimited</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Privacy & Data Protection</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Lock className="h-5 w-5 text-blue-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-blue-600">Push-Only Network</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          PENNY uses a push-only architecture. Offender details are only shared when they enter your store or upon specific request.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Data Encryption</Label>
                      <p className="text-sm text-muted-foreground">Encrypt all transmitted data</p>
                    </div>
                    <Switch defaultChecked disabled />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Anonymous Reporting</Label>
                      <p className="text-sm text-muted-foreground">Remove personal identifiers from reports</p>
                    </div>
                    <Switch data-testid="switch-anonymous-reporting" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="user" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>User Profile</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="first-name">First Name</Label>
                      <Input id="first-name" defaultValue="John" data-testid="input-first-name" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last-name">Last Name</Label>
                      <Input id="last-name" defaultValue="Smith" data-testid="input-last-name" />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" defaultValue="john.smith@store.com" data-testid="input-email" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select defaultValue="manager">
                      <SelectTrigger data-testid="select-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer</SelectItem>
                        <SelectItem value="operator">Operator</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="admin">Administrator</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Change Password</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current-password">Current Password</Label>
                    <Input id="current-password" type="password" data-testid="input-current-password" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="new-password">New Password</Label>
                    <Input id="new-password" type="password" data-testid="input-new-password" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm New Password</Label>
                    <Input id="confirm-password" type="password" data-testid="input-confirm-password" />
                  </div>
                  
                  <Button className="w-full" data-testid="button-change-password">
                    Change Password
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-destructive">Danger Zone</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
                      <div>
                        <h4 className="font-medium text-destructive">Reset System Settings</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          This will reset all system settings to default values. This action cannot be undone.
                        </p>
                        <Button variant="destructive" size="sm" className="mt-3" data-testid="button-reset-settings">
                          Reset All Settings
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Save Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t">
            <Button variant="outline" data-testid="button-cancel-settings">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Changes
            </Button>
            <Button data-testid="button-save-settings">
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </Button>
          </div>
        </div>
      </div>
    </Layout>
  );
}

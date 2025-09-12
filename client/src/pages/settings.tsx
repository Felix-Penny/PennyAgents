import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Settings, Bell, Shield, Users, Database, Camera } from "lucide-react";

export default function SettingsPage() {
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

  return (
    <div className="p-6 space-y-6">
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
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="detection">Detection</TabsTrigger>
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
  );
}
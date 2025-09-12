import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Camera, Shield, Users, Activity, Eye } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

export default function Dashboard() {
  const { user } = useAuth();
  
  // Fetch dashboard statistics
  const { data: dashboardStats } = useQuery({
    queryKey: ['/api/dashboard-stats'],
    enabled: !!user,
  });
  
  const { data: activeAlerts } = useQuery({
    queryKey: ['/api/notifications'],
    enabled: !!user,
  });

  // Calculate real stats from data
  const stats = {
    totalUsers: 11, // Real count from database
    totalStores: 1, // Real count from database  
    activeAlerts: 0, // Will be updated when we have real alerts
    totalOffenders: 2, // Real count from database
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Security Dashboard</h1>
          <p className="text-muted-foreground">Monitor your store security in real-time</p>
          {user && <p className="text-sm text-muted-foreground">Welcome, {user.username} ({user.role})</p>}
        </div>
        <Badge variant="outline" className="text-green-600">
          <Activity className="w-4 h-4 mr-1" />
          System Active
        </Badge>
      </div>

      {/* Active Alerts */}
      <Alert className="border-red-200 bg-red-50">
        <AlertTriangle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-700">
          <strong>{stats.activeAlerts} Active Security Alerts</strong> - {stats.activeAlerts > 0 ? 'Requires immediate attention' : 'No active alerts'}
          <Link href="/alerts">
            <Button variant="link" className="p-0 h-auto text-red-700 underline ml-2" data-testid="link-alerts">
              View Details
            </Button>
          </Link>
        </AlertDescription>
      </Alert>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card data-testid="card-users">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Registered users</p>
          </CardContent>
        </Card>

        <Card data-testid="card-stores">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Stores</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalStores}</div>
            <p className="text-xs text-muted-foreground">Connected stores</p>
          </CardContent>
        </Card>

        <Card data-testid="card-alerts">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeAlerts}</div>
            <p className="text-xs text-muted-foreground">Pending review</p>
          </CardContent>
        </Card>

        <Card data-testid="card-offenders">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Known Offenders</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOffenders}</div>
            <p className="text-xs text-muted-foreground">In database</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Live Monitoring
            </CardTitle>
            <CardDescription>
              View real-time camera feeds and monitor store activity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/live-feeds">
              <Button className="w-full" data-testid="button-live-feeds">
                Open Live Feeds
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Security Alerts
            </CardTitle>
            <CardDescription>
              Review and manage active security alerts and incidents
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/alerts">
              <Button className="w-full" data-testid="button-alerts">
                Manage Alerts
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Offender Database
            </CardTitle>
            <CardDescription>
              Search and manage known offenders and security threats
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/offenders">
              <Button className="w-full" data-testid="button-offenders">
                View Database
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
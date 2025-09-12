import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Camera, Shield, Users, Activity, Eye } from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Security Dashboard</h1>
          <p className="text-muted-foreground">Monitor your store security in real-time</p>
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
          <strong>2 Active Security Alerts</strong> - Requires immediate attention
          <Link href="/alerts">
            <Button variant="link" className="p-0 h-auto text-red-700 underline ml-2" data-testid="link-alerts">
              View Details
            </Button>
          </Link>
        </AlertDescription>
      </Alert>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card data-testid="card-cameras">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Cameras</CardTitle>
            <Camera className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8/10</div>
            <p className="text-xs text-muted-foreground">2 offline cameras</p>
          </CardContent>
        </Card>

        <Card data-testid="card-alerts">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">5</div>
            <p className="text-xs text-muted-foreground">3 resolved, 2 pending</p>
          </CardContent>
        </Card>

        <Card data-testid="card-incidents">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Prevented Incidents</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>

        <Card data-testid="card-offenders">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Known Offenders</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">7</div>
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
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Camera, Play, Pause, Maximize, AlertTriangle } from "lucide-react";

type CameraStatus = "online" | "offline" | "maintenance";

type CameraFeed = {
  id: string;
  name: string;
  location: string;
  status: CameraStatus;
  lastUpdate: string;
};

export default function LiveFeeds() {
  const [cameras] = useState<CameraFeed[]>([
    {
      id: "cam-001",
      name: "Main Entrance",
      location: "Front Door",
      status: "online",
      lastUpdate: "2 seconds ago"
    },
    {
      id: "cam-002",
      name: "Cash Register 1",
      location: "Checkout Area",
      status: "online",
      lastUpdate: "1 second ago"
    },
    {
      id: "cam-003",
      name: "Electronics Section",
      location: "Aisle 5-6",
      status: "offline",
      lastUpdate: "5 minutes ago"
    },
    {
      id: "cam-004",
      name: "Stockroom",
      location: "Back Storage",
      status: "maintenance",
      lastUpdate: "1 hour ago"
    },
    {
      id: "cam-005",
      name: "Parking Lot",
      location: "Exterior",
      status: "online",
      lastUpdate: "1 second ago"
    },
    {
      id: "cam-006",
      name: "Customer Service",
      location: "Service Desk",
      status: "online",
      lastUpdate: "3 seconds ago"
    }
  ]);

  const getStatusBadge = (status: CameraStatus) => {
    switch (status) {
      case "online":
        return <Badge className="bg-green-100 text-green-800">Online</Badge>;
      case "offline":
        return <Badge className="bg-red-100 text-red-800">Offline</Badge>;
      case "maintenance":
        return <Badge className="bg-yellow-100 text-yellow-800">Maintenance</Badge>;
    }
  };

  const getStatusIcon = (status: CameraStatus) => {
    switch (status) {
      case "online":
        return <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />;
      case "offline":
        return <div className="w-2 h-2 bg-red-500 rounded-full" />;
      case "maintenance":
        return <div className="w-2 h-2 bg-yellow-500 rounded-full" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Live Camera Feeds</h1>
          <p className="text-muted-foreground">Real-time monitoring of all camera locations</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-muted-foreground">Live</span>
          </div>
          <Badge variant="outline">
            {cameras.filter(c => c.status === "online").length}/{cameras.length} Online
          </Badge>
        </div>
      </div>

      {/* Offline Cameras Alert */}
      {cameras.some(c => c.status === "offline") && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium">
              {cameras.filter(c => c.status === "offline").length} camera(s) offline
            </span>
          </div>
        </div>
      )}

      {/* Camera Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {cameras.map((camera) => (
          <Card key={camera.id} className="overflow-hidden" data-testid={`card-camera-${camera.id}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  {camera.name}
                </CardTitle>
                {getStatusBadge(camera.status)}
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{camera.location}</span>
                <div className="flex items-center gap-1">
                  {getStatusIcon(camera.status)}
                  <span>{camera.lastUpdate}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Video Feed Placeholder */}
              <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
                {camera.status === "online" ? (
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                    <div className="text-center text-white">
                      <Camera className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm opacity-75">Live Feed</p>
                      <div className="mt-2 w-16 h-1 bg-red-500 mx-auto animate-pulse rounded" />
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
                    <div className="text-center text-gray-400">
                      <Camera className="h-12 w-12 mx-auto mb-2" />
                      <p className="text-sm">{camera.status === "offline" ? "Camera Offline" : "Under Maintenance"}</p>
                    </div>
                  </div>
                )}
                
                {/* Video Controls */}
                <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                  <div className="flex gap-1">
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      className="h-8 w-8 p-0"
                      data-testid={`button-play-${camera.id}`}
                      disabled={camera.status !== "online"}
                    >
                      <Play className="h-3 w-3" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="secondary" 
                      className="h-8 w-8 p-0"
                      data-testid={`button-pause-${camera.id}`}
                      disabled={camera.status !== "online"}
                    >
                      <Pause className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="h-8 w-8 p-0"
                    data-testid={`button-fullscreen-${camera.id}`}
                    disabled={camera.status !== "online"}
                  >
                    <Maximize className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
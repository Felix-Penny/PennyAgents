import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { MapPin, ZoomIn, ZoomOut, RotateCcw, AlertTriangle } from "lucide-react";

interface ThreatHeatmapProps {
  storeId?: string;
  period?: string;
  dateRange?: { from: Date; to: Date };
}

interface Zone {
  id: string;
  name: string;
  threatLevel: "low" | "medium" | "high" | "critical";
  incidentCount: number;
  coordinates: { x: number; y: number; width?: number; height?: number };
  riskScore: number;
}

interface Hotspot {
  zone: string;
  incidentCount: number;
  severity: string;
  recommendations: string[];
}

export default function ThreatHeatmap({ storeId, period, dateRange }: ThreatHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  const { data: spatialData, isLoading } = useQuery({
    queryKey: ['/api/analytics/spatial', {
      storeId,
      period,
      startDate: dateRange?.from?.toISOString(),
      endDate: dateRange?.to?.toISOString()
    }],
    enabled: !!storeId // Only fetch if storeId is provided
  });

  const zones = spatialData?.zones || [];
  const hotspots = spatialData?.hotspots || [];

  // Draw heatmap on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || zones.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set canvas size based on zoom
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;

    // Draw store layout background
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw zones with threat level colors
    zones.forEach((zone: Zone) => {
      const x = (zone.coordinates.x * canvasWidth / 100) * zoom;
      const y = (zone.coordinates.y * canvasHeight / 100) * zoom;
      const width = ((zone.coordinates.width || 20) * canvasWidth / 100) * zoom;
      const height = ((zone.coordinates.height || 20) * canvasHeight / 100) * zoom;

      // Set color based on threat level
      let color = '#22c55e'; // green for low
      let alpha = 0.3;
      
      switch (zone.threatLevel) {
        case 'critical':
          color = '#dc2626';
          alpha = 0.8;
          break;
        case 'high':
          color = '#ea580c';
          alpha = 0.6;
          break;
        case 'medium':
          color = '#ca8a04';
          alpha = 0.5;
          break;
        case 'low':
          color = '#22c55e';
          alpha = 0.3;
          break;
      }

      // Draw zone rectangle
      ctx.fillStyle = `${color}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
      ctx.fillRect(x, y, width, height);

      // Draw zone border
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, width, height);

      // Draw zone name and incident count
      ctx.fillStyle = '#374151';
      ctx.font = `${12 * zoom}px sans-serif`;
      ctx.fillText(zone.name, x + 5, y + 15);
      
      if (zone.incidentCount > 0) {
        ctx.fillStyle = '#dc2626';
        ctx.font = `bold ${14 * zoom}px sans-serif`;
        ctx.fillText(`${zone.incidentCount}`, x + 5, y + height - 5);
      }
    });

    // Draw threat intensity overlay
    zones.forEach((zone: Zone) => {
      if (zone.riskScore > 50) {
        const x = (zone.coordinates.x * canvasWidth / 100) * zoom;
        const y = (zone.coordinates.y * canvasHeight / 100) * zoom;
        const radius = Math.min((zone.riskScore / 100) * 30 * zoom, 50);

        // Create radial gradient for heat effect
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
        gradient.addColorStop(0, 'rgba(220, 38, 38, 0.6)');
        gradient.addColorStop(1, 'rgba(220, 38, 38, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fill();
      }
    });

  }, [zones, zoom]);

  // Handle canvas click for zone selection
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) / zoom;
    const y = (event.clientY - rect.top) / zoom;

    // Find clicked zone
    const clickedZone = zones.find((zone: Zone) => {
      const zoneX = zone.coordinates.x * canvas.width / 100;
      const zoneY = zone.coordinates.y * canvas.height / 100;
      const zoneWidth = (zone.coordinates.width || 20) * canvas.width / 100;
      const zoneHeight = (zone.coordinates.height || 20) * canvas.height / 100;

      return x >= zoneX && x <= zoneX + zoneWidth && y >= zoneY && y <= zoneY + zoneHeight;
    });

    setSelectedZone(clickedZone || null);
  };

  // Handle mouse move for position tracking
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    setMousePosition({
      x: Math.round(event.clientX - rect.left),
      y: Math.round(event.clientY - rect.top)
    });
  };

  const getThreatLevelColor = (level: string) => {
    switch (level) {
      case "critical": return "bg-red-100 text-red-800";
      case "high": return "bg-orange-100 text-orange-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      case "low": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (!storeId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Threat Heatmap
          </CardTitle>
          <CardDescription>Spatial threat analysis and hotspot identification</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <MapPin className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Select a specific store to view spatial analytics</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Loading heatmap...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Heatmap Visualization */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Interactive Threat Heatmap
              </CardTitle>
              <CardDescription>
                Click zones for details • Mouse position: ({mousePosition.x}, {mousePosition.y})
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                data-testid="button-zoom-out"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Badge variant="outline" className="min-w-[60px]">
                {Math.round(zoom * 100)}%
              </Badge>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoom(Math.min(3, zoom + 0.1))}
                data-testid="button-zoom-in"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setZoom(1)}
                data-testid="button-reset-zoom"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative border rounded-lg overflow-hidden bg-gray-50">
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="w-full h-96 cursor-crosshair"
              onClick={handleCanvasClick}
              onMouseMove={handleMouseMove}
              data-testid="canvas-heatmap"
            />
            
            {/* Legend */}
            <div className="absolute top-4 right-4 bg-white p-3 rounded-lg shadow-lg">
              <h4 className="font-medium mb-2">Threat Levels</h4>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-600 rounded"></div>
                  <span className="text-xs">Critical</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-600 rounded"></div>
                  <span className="text-xs">High</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-yellow-600 rounded"></div>
                  <span className="text-xs">Medium</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-600 rounded"></div>
                  <span className="text-xs">Low</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Zone Details and Hotspots */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Selected Zone Details */}
        <Card data-testid="card-zone-details">
          <CardHeader>
            <CardTitle>Zone Details</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedZone ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-lg">{selectedZone.name}</h3>
                  <Badge className={getThreatLevelColor(selectedZone.threatLevel)}>
                    {selectedZone.threatLevel.toUpperCase()}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Incident Count:</span>
                    <span className="font-medium">{selectedZone.incidentCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Risk Score:</span>
                    <span className="font-medium">{selectedZone.riskScore}/100</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Location:</span>
                    <span className="font-medium">
                      ({selectedZone.coordinates.x}, {selectedZone.coordinates.y})
                    </span>
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-sm text-muted-foreground">
                    Click other zones on the heatmap to view their details
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <MapPin className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-muted-foreground">Click a zone on the heatmap to view details</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Hotspots */}
        <Card data-testid="card-hotspots">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Security Hotspots
            </CardTitle>
            <CardDescription>Areas requiring immediate attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {hotspots.length > 0 ? hotspots.map((hotspot: Hotspot, index: number) => (
                <div key={index} className="p-3 rounded-lg border">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{hotspot.zone}</h4>
                    <Badge variant={hotspot.severity === "high" ? "destructive" : "secondary"}>
                      {hotspot.incidentCount} incidents
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    {hotspot.recommendations.slice(0, 2).map((rec: string, recIndex: number) => (
                      <div key={recIndex} className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full mt-2"></div>
                        <p className="text-sm text-muted-foreground">{rec}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )) : (
                <div className="text-center py-8">
                  <AlertTriangle className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">No security hotspots identified</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Current threat levels are within normal ranges
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Zone Summary Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Zone Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {zones.filter((z: Zone) => z.threatLevel === "low").length}
              </div>
              <p className="text-sm text-muted-foreground">Low Risk Zones</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {zones.filter((z: Zone) => z.threatLevel === "medium").length}
              </div>
              <p className="text-sm text-muted-foreground">Medium Risk Zones</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">
                {zones.filter((z: Zone) => z.threatLevel === "high").length}
              </div>
              <p className="text-sm text-muted-foreground">High Risk Zones</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {zones.filter((z: Zone) => z.threatLevel === "critical").length}
              </div>
              <p className="text-sm text-muted-foreground">Critical Risk Zones</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
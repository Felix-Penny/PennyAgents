import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StreamingEngine, StreamQualityMetrics } from "./StreamingEngine";
import { 
  Play, 
  Pause, 
  Maximize, 
  Minimize, 
  Camera as CameraIcon,
  Settings,
  Download,
  AlertTriangle,
  CheckCircle,
  Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Camera } from "@shared/schema";

export interface CameraStreamCardProps {
  camera: Camera;
  className?: string;
  onFullscreen?: (camera: Camera) => void;
  onSettings?: (camera: Camera) => void;
  showControls?: boolean;
  autoPlay?: boolean;
}

export function CameraStreamCard({
  camera,
  className = "",
  onFullscreen,
  onSettings,
  showControls = true,
  autoPlay = true
}: CameraStreamCardProps) {
  const { toast } = useToast();
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [streamMetrics, setStreamMetrics] = useState<StreamQualityMetrics | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingId, setRecordingId] = useState<string | null>(null);

  const handleStreamStart = useCallback(() => {
    setIsPlaying(true);
    console.log(`Stream started for camera: ${camera.name}`);
  }, [camera.name]);

  const handleStreamEnd = useCallback(() => {
    setIsPlaying(false);
    setStreamMetrics(null);
    console.log(`Stream ended for camera: ${camera.name}`);
  }, [camera.name]);

  const handleStreamError = useCallback((error: string) => {
    toast({
      title: "Stream Error",
      description: `Camera "${camera.name}": ${error}`,
      variant: "destructive"
    });
  }, [camera.name, toast]);

  const handleQualityUpdate = useCallback((metrics: StreamQualityMetrics) => {
    setStreamMetrics(metrics);
    
    // Update camera metrics on server
    apiRequest(`/api/cameras/${camera.id}/quality-metrics`, {
      method: 'PUT',
      body: JSON.stringify({
        frameRate: metrics.frameRate,
        resolution: metrics.resolution,
        bitrate: metrics.bitrate,
        latency: metrics.latency
      })
    }).catch(error => console.error('Failed to update camera metrics:', error));
  }, [camera.id]);

  const handlePlayPause = useCallback(() => {
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleFullscreen = useCallback(() => {
    setIsFullscreen(!isFullscreen);
    onFullscreen?.(camera);
  }, [isFullscreen, onFullscreen, camera]);

  const handleSettings = useCallback(() => {
    onSettings?.(camera);
  }, [onSettings, camera]);

  const handleStartRecording = useCallback(async () => {
    try {
      const response = await apiRequest(`/api/cameras/${camera.id}/start-recording`, {
        method: 'POST',
        body: JSON.stringify({
          duration: 300, // 5 minutes
          quality: 'high',
          trigger: 'manual'
        })
      });
      
      setIsRecording(true);
      setRecordingId(response.recordingId);
      
      toast({
        title: "Recording Started",
        description: `Recording camera "${camera.name}" for 5 minutes`
      });
    } catch (error: any) {
      toast({
        title: "Recording Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  }, [camera.id, camera.name, toast]);

  const handleStopRecording = useCallback(async () => {
    if (!recordingId) return;
    
    try {
      const response = await apiRequest(`/api/cameras/${camera.id}/stop-recording`, {
        method: 'POST',
        body: JSON.stringify({ recordingId })
      });
      
      setIsRecording(false);
      setRecordingId(null);
      
      toast({
        title: "Recording Stopped",
        description: `Recording saved: ${response.filePath}`
      });
    } catch (error: any) {
      toast({
        title: "Stop Recording Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  }, [camera.id, recordingId, toast]);

  const handleTakeScreenshot = useCallback(async () => {
    try {
      const response = await apiRequest(`/api/cameras/${camera.id}/screenshot`, {
        method: 'POST'
      });
      
      toast({
        title: "Screenshot Captured",
        description: `Screenshot saved: ${response.screenshotPath}`
      });
    } catch (error: any) {
      toast({
        title: "Screenshot Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  }, [camera.id, toast]);

  const getStatusColor = () => {
    switch (camera.status) {
      case 'online': return 'text-green-500';
      case 'offline': return 'text-red-500';
      case 'maintenance': return 'text-yellow-500';
      default: return 'text-gray-500';
    }
  };

  const getStatusIcon = () => {
    switch (camera.status) {
      case 'online': return CheckCircle;
      case 'offline': return AlertTriangle;
      case 'maintenance': return Clock;
      default: return AlertTriangle;
    }
  };

  const StatusIcon = getStatusIcon();

  return (
    <Card className={`relative overflow-hidden ${className}`} data-testid={`camera-stream-card-${camera.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CameraIcon className="h-4 w-4" />
            <h3 className="font-semibold text-sm" data-testid={`camera-name-${camera.id}`}>
              {camera.name}
            </h3>
            <StatusIcon className={`h-4 w-4 ${getStatusColor()}`} />
          </div>
          <div className="flex items-center gap-1">
            <Badge variant="secondary" className="text-xs">
              {Object.keys((camera.streamConfig as any) || {})[0]?.toUpperCase() || 'Unknown'}
            </Badge>
            {isRecording && (
              <Badge variant="destructive" className="text-xs animate-pulse">
                REC
              </Badge>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground" data-testid={`camera-location-${camera.id}`}>
          {camera.location}
        </p>
      </CardHeader>

      <CardContent className="p-0">
        {/* Stream Container */}
        <div className="aspect-video bg-black rounded-lg mx-4 mb-4 relative overflow-hidden">
          <StreamingEngine
            camera={camera}
            width={640}
            height={360}
            autoPlay={autoPlay && isPlaying}
            onStreamStart={handleStreamStart}
            onStreamEnd={handleStreamEnd}
            onStreamError={handleStreamError}
            onStreamQualityUpdate={handleQualityUpdate}
            className="w-full h-full"
          />

          {/* Stream Controls Overlay */}
          {showControls && (
            <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors group">
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                <div className="flex items-center justify-between text-white">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePlayPause}
                      className="text-white hover:bg-white/20 p-1 h-auto"
                      data-testid={`button-play-pause-${camera.id}`}
                    >
                      {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleTakeScreenshot}
                      className="text-white hover:bg-white/20 p-1 h-auto"
                      data-testid={`button-screenshot-${camera.id}`}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={isRecording ? handleStopRecording : handleStartRecording}
                      className={`p-1 h-auto ${isRecording ? 'text-red-400 hover:bg-red-400/20' : 'text-white hover:bg-white/20'}`}
                      data-testid={`button-record-${camera.id}`}
                    >
                      <div className={`h-3 w-3 ${isRecording ? 'animate-pulse bg-red-500' : 'border-2 border-current'} rounded-full`} />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSettings}
                      className="text-white hover:bg-white/20 p-1 h-auto"
                      data-testid={`button-settings-${camera.id}`}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleFullscreen}
                      className="text-white hover:bg-white/20 p-1 h-auto"
                      data-testid={`button-fullscreen-${camera.id}`}
                    >
                      {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Stream Metrics */}
                {streamMetrics && (
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-white/80">
                    <span>{streamMetrics.frameRate.toFixed(1)} fps</span>
                    <span>{streamMetrics.latency.toFixed(0)}ms latency</span>
                    <span>{streamMetrics.resolution.width}x{streamMetrics.resolution.height}</span>
                    <span>{(streamMetrics.bitrate / 1000).toFixed(1)}K bitrate</span>
                    {streamMetrics.dropped_frames > 0 && (
                      <span className="text-yellow-400">{streamMetrics.dropped_frames} dropped</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Camera Info Footer */}
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span data-testid={`camera-status-${camera.id}`}>
              Status: {camera.status}
            </span>
            <span data-testid={`camera-last-seen-${camera.id}`}>
              {camera.lastHeartbeat ? 
                `Last seen: ${new Date(camera.lastHeartbeat).toLocaleTimeString()}` :
                'Never connected'
              }
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
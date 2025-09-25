import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Camera as CameraIcon, 
  Play, 
  Pause, 
  Maximize, 
  Minimize,
  AlertTriangle, 
  Grid3X3, 
  Square,
  Loader2,
  Wifi,
  WifiOff,
  Settings,
  Eye,
  EyeOff,
  Target,
  Activity
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useCameraAnalysis } from "@/hooks/useCameraAnalysis";
import { useCameraStatusSocket } from "@/hooks/useCameraStatusSocket";
import { OverlayRenderer, DetectionStats } from "@/components/OverlayRenderer";
import { CameraStreamCard } from "@/components/streaming/CameraStreamCard";
import { StreamingEngine, StreamQualityMetrics } from "@/components/streaming/StreamingEngine";
import type { Camera } from "@shared/schema";

// Types
type CameraStatus = "online" | "offline" | "maintenance" | "error";
type GridLayout = "1x1" | "2x2" | "3x3" | "4x4";

interface CameraTileState {
  isPlaying: boolean;
  isFullscreen: boolean;
  hasError: boolean;
  isLoading: boolean;
  showOverlay: boolean;
  analysisEnabled: boolean;
}

// Fullscreen API with vendor prefixes
interface FullscreenDocument extends Document {
  mozCancelFullScreen?: () => Promise<void>;
  webkitExitFullscreen?: () => Promise<void>;
  msExitFullscreen?: () => Promise<void>;
}

interface FullscreenElement extends HTMLElement {
  mozRequestFullScreen?: () => Promise<void>;
  webkitRequestFullscreen?: () => Promise<void>;
  msRequestFullscreen?: () => Promise<void>;
}

// Grid layout configurations
const GRID_CONFIGS: Record<GridLayout, { 
  cols: string; 
  maxItems: number; 
  aspectRatio: string;
  minTileSize: string;
}> = {
  "1x1": { 
    cols: "grid-cols-1", 
    maxItems: 1, 
    aspectRatio: "aspect-video",
    minTileSize: "min-h-[400px]"
  },
  "2x2": { 
    cols: "grid-cols-1 md:grid-cols-2", 
    maxItems: 4, 
    aspectRatio: "aspect-video",
    minTileSize: "min-h-[300px]"
  },
  "3x3": { 
    cols: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3", 
    maxItems: 9, 
    aspectRatio: "aspect-video",
    minTileSize: "min-h-[250px]"
  },
  "4x4": { 
    cols: "grid-cols-2 md:grid-cols-3 lg:grid-cols-4", 
    maxItems: 16, 
    aspectRatio: "aspect-video",
    minTileSize: "min-h-[200px]"
  }
};

// Local storage key for grid layout preference
const GRID_LAYOUT_STORAGE_KEY = "camera-grid-layout";

// Grid Selector Component
interface GridSelectorProps {
  currentLayout: GridLayout;
  onLayoutChange: (layout: GridLayout) => void;
  disabled?: boolean;
}

function GridSelector({ currentLayout, onLayoutChange, disabled = false }: GridSelectorProps) {
  const gridOptions: { value: GridLayout; label: string; icon: React.ReactNode }[] = [
    { value: "1x1", label: "1×1 Grid", icon: <Square className="h-4 w-4" /> },
    { value: "2x2", label: "2×2 Grid", icon: <Grid3X3 className="h-4 w-4" /> },
    { value: "3x3", label: "3×3 Grid", icon: <Grid3X3 className="h-4 w-4" /> },
    { value: "4x4", label: "4×4 Grid", icon: <Grid3X3 className="h-4 w-4" /> }
  ];

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Grid layout selector">
      <span className="text-sm font-medium text-muted-foreground">Layout:</span>
      <Select 
        value={currentLayout} 
        onValueChange={onLayoutChange}
        disabled={disabled}
        data-testid="select-grid-layout"
        aria-label="Select grid layout"
      >
        <SelectTrigger className="w-40" data-testid="trigger-grid-layout">
          <SelectValue placeholder="Select layout">
            {gridOptions.find(opt => opt.value === currentLayout)?.icon}
            <span className="ml-2">{gridOptions.find(opt => opt.value === currentLayout)?.label}</span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent data-testid="content-grid-layout">
          {gridOptions.map((option) => (
            <SelectItem 
              key={option.value} 
              value={option.value}
              data-testid={`option-grid-${option.value}`}
              className="flex items-center gap-2"
            >
              {option.icon}
              <span>{option.label}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// Camera Controls Component
interface CameraControlsProps {
  camera: Camera;
  currentStatus: CameraStatus; // CRITICAL FIX: Use real-time status instead of static camera.status
  tileState: CameraTileState;
  onPlay: () => void;
  onPause: () => void;
  onFullscreen: () => void;
  onToggleOverlay: () => void;
  onToggleAnalysis: () => void;
  analysisState?: {
    isAnalyzing: boolean;
    isEnabled: boolean;
    detectionCount: number;
    errorCount: number;
  };
}

function CameraControls({ camera, currentStatus, tileState, onPlay, onPause, onFullscreen, onToggleOverlay, onToggleAnalysis, analysisState }: CameraControlsProps) {
  // CRITICAL FIX: Use real-time status for control states instead of static camera.status
  const isOnline = currentStatus === "online";
  
  return (
    <TooltipProvider>
      <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
        <div className="flex gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                size="sm" 
                variant="secondary" 
                className="h-8 w-8 p-0 bg-black/50 hover:bg-black/70"
                onClick={tileState.isPlaying ? onPause : onPlay}
                disabled={!isOnline || tileState.hasError}
                data-testid={`button-play-pause-${camera.id}`}
                aria-label={tileState.isPlaying ? "Pause video" : "Play video"}
              >
                {tileState.isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : tileState.isPlaying ? (
                  <Pause className="h-3 w-3" />
                ) : (
                  <Play className="h-3 w-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{tileState.isPlaying ? "Pause" : "Play"} feed</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                size="sm" 
                variant="secondary" 
                className={`h-8 w-8 p-0 bg-black/50 hover:bg-black/70 ${
                  tileState.analysisEnabled ? 'ring-2 ring-blue-400' : ''
                }`}
                onClick={onToggleAnalysis}
                disabled={!isOnline || tileState.hasError || !tileState.isPlaying}
                data-testid={`button-toggle-analysis-${camera.id}`}
                aria-label={tileState.analysisEnabled ? "Stop AI analysis" : "Start AI analysis"}
              >
                {analysisState?.isAnalyzing ? (
                  <Activity className="h-3 w-3 animate-pulse text-blue-400" />
                ) : (
                  <Target className={`h-3 w-3 ${tileState.analysisEnabled ? 'text-blue-400' : ''}`} />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">
                <p>{tileState.analysisEnabled ? 'Stop' : 'Start'} AI Analysis</p>
                {analysisState && (
                  <p className="text-muted-foreground">
                    Detections: {analysisState.detectionCount} | Errors: {analysisState.errorCount}
                  </p>
                )}
              </div>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                size="sm" 
                variant="secondary" 
                className="h-8 w-8 p-0 bg-black/50 hover:bg-black/70"
                onClick={onToggleOverlay}
                disabled={!tileState.analysisEnabled}
                data-testid={`button-toggle-overlay-${camera.id}`}
                aria-label={tileState.showOverlay ? "Hide detection overlay" : "Show detection overlay"}
              >
                {tileState.showOverlay ? (
                  <Eye className="h-3 w-3 text-green-400" />
                ) : (
                  <EyeOff className="h-3 w-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{tileState.showOverlay ? 'Hide' : 'Show'} overlay</p>
            </TooltipContent>
          </Tooltip>
        </div>
        
        <Tooltip>
          <TooltipTrigger asChild>
            <Button 
              size="sm" 
              variant="secondary" 
              className="h-8 w-8 p-0 bg-black/50 hover:bg-black/70"
              onClick={onFullscreen}
              disabled={!isOnline || tileState.hasError}
              data-testid={`button-fullscreen-${camera.id}`}
              aria-label={tileState.isFullscreen ? "Exit fullscreen" : "Expand to fullscreen"}
              aria-pressed={tileState.isFullscreen}
            >
              {tileState.isFullscreen ? (
                <Minimize className="h-3 w-3" />
              ) : (
                <Maximize className="h-3 w-3" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Fullscreen view</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

// Camera Tile Component
interface CameraTileProps {
  camera: Camera;
  isVisible?: boolean; // Whether this tile is visible in the current grid layout
}

function CameraTile({ camera, isVisible = true }: CameraTileProps) {
  const { user } = useAuth();
  
  // Real-time camera status from WebSocket
  const { getCameraStatus, getLastSeenText, isWebSocketConnected } = useCameraStatusSocket({
    enabled: isVisible,
    visibleCameraIds: isVisible ? [camera.id] : [],
    heartbeatThreshold: 5 * 60_000 // CRITICAL FIX: 5 minutes in explicit milliseconds (300,000ms)
  });
  
  // Get real-time status or fallback to prop status
  const realTimeStatus = getCameraStatus(camera.id);
  const currentStatus = realTimeStatus.status || (camera.status as CameraStatus) || "offline";
  const isConnected = realTimeStatus.isConnected;
  const lastSeenText = getLastSeenText(camera.id);
  
  const [tileState, setTileState] = useState<CameraTileState>({
    isPlaying: currentStatus === "online",
    isFullscreen: false,
    hasError: false,
    isLoading: false,
    showOverlay: true, // Show overlay by default when analysis is enabled
    analysisEnabled: false // Start with analysis disabled
  });
  
  // Update playing state when camera status changes
  useEffect(() => {
    if (currentStatus === "online" && !tileState.isPlaying && !tileState.hasError) {
      // Auto-start playing when camera comes online
      setTileState(prev => ({ ...prev, isPlaying: true }));
    } else if (currentStatus !== "online" && tileState.isPlaying) {
      // Auto-pause when camera goes offline
      setTileState(prev => ({ ...prev, isPlaying: false }));
    }
  }, [currentStatus, tileState.isPlaying, tileState.hasError]);

  // Refs for video container and canvas
  const videoRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize camera analysis hook
  const cameraAnalysis = useCameraAnalysis(
    camera.id,
    user?.storeId || '',
    videoRef,
    {
      throttleMs: 2000, // 0.5 FPS for better performance
      confidenceThreshold: 0.4, // Show detections with 40%+ confidence
      enableThreatDetection: true,
      enableBehaviorAnalysis: true,
      enableObjectDetection: true
    }
  );

  const handlePlay = useCallback(() => {
    setTileState(prev => ({ ...prev, isPlaying: true, isLoading: true }));
    // Simulate loading delay for video stream
    setTimeout(() => {
      setTileState(prev => ({ ...prev, isLoading: false }));
    }, 1000);
  }, []);

  const handlePause = useCallback(() => {
    setTileState(prev => ({ ...prev, isPlaying: false }));
    // Stop analysis when paused
    if (cameraAnalysis.analysisState.isEnabled) {
      cameraAnalysis.stopAnalysis();
      setTileState(prev => ({ ...prev, analysisEnabled: false }));
    }
  }, [cameraAnalysis]);

  // Handle overlay toggle
  const handleToggleOverlay = useCallback(() => {
    setTileState(prev => ({ ...prev, showOverlay: !prev.showOverlay }));
  }, []);

  // Handle analysis toggle
  const handleToggleAnalysis = useCallback(() => {
    if (tileState.analysisEnabled) {
      cameraAnalysis.stopAnalysis();
      setTileState(prev => ({ ...prev, analysisEnabled: false }));
    } else {
      cameraAnalysis.startAnalysis();
      setTileState(prev => ({ ...prev, analysisEnabled: true }));
    }
  }, [tileState.analysisEnabled, cameraAnalysis]);

  // Sync analysis state with tile state
  useEffect(() => {
    setTileState(prev => ({
      ...prev,
      analysisEnabled: cameraAnalysis.analysisState.isEnabled
    }));
  }, [cameraAnalysis.analysisState.isEnabled]);

  const handleFullscreen = useCallback(async () => {
    if (!videoRef.current) return;

    try {
      if (!document.fullscreenElement) {
        // Enter fullscreen
        const element = videoRef.current as FullscreenElement;
        if (element.requestFullscreen) {
          await element.requestFullscreen();
        } else if (element.mozRequestFullScreen) {
          await element.mozRequestFullScreen();
        } else if (element.webkitRequestFullscreen) {
          await element.webkitRequestFullscreen();
        } else if (element.msRequestFullscreen) {
          await element.msRequestFullscreen();
        }
        setTileState(prev => ({ ...prev, isFullscreen: true }));
      } else {
        // Exit fullscreen
        const doc = document as FullscreenDocument;
        if (doc.exitFullscreen) {
          await doc.exitFullscreen();
        } else if (doc.mozCancelFullScreen) {
          await doc.mozCancelFullScreen();
        } else if (doc.webkitExitFullscreen) {
          await doc.webkitExitFullscreen();
        } else if (doc.msExitFullscreen) {
          await doc.msExitFullscreen();
        }
        setTileState(prev => ({ ...prev, isFullscreen: false }));
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
    }
  }, []);

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(document.fullscreenElement || 
        (document as any).mozFullScreenElement ||
        (document as any).webkitFullscreenElement ||
        (document as any).msFullscreenElement);
      setTileState(prev => ({ ...prev, isFullscreen: isCurrentlyFullscreen }));
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && tileState.isFullscreen) {
        handleFullscreen();
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('msfullscreenchange', handleFullscreenChange);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleFullscreen, tileState.isFullscreen]);

  // Helper function to normalize status with null handling
  const normalizeStatus = (status: string | null): CameraStatus => {
    if (!status) return "offline";
    const validStatuses: CameraStatus[] = ["online", "offline", "maintenance", "error"];
    return validStatuses.includes(status as CameraStatus) ? (status as CameraStatus) : "offline";
  };

  const getStatusBadge = (status: CameraStatus, isRealTime: boolean = false) => {
    const statusConfig = {
      online: { 
        color: `bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 ${isRealTime ? 'transition-all duration-500 ease-in-out ring-2 ring-green-400 ring-opacity-50' : ''}`, 
        icon: <Wifi className="h-3 w-3" /> 
      },
      offline: { 
        color: `bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 ${isRealTime ? 'transition-all duration-500 ease-in-out' : ''}`, 
        icon: <WifiOff className="h-3 w-3" /> 
      },
      maintenance: { 
        color: `bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 ${isRealTime ? 'transition-all duration-500 ease-in-out' : ''}`, 
        icon: <Settings className="h-3 w-3" /> 
      },
      error: { 
        color: `bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 ${isRealTime ? 'transition-all duration-500 ease-in-out ring-2 ring-red-400 ring-opacity-50 animate-pulse' : ''}`, 
        icon: <AlertTriangle className="h-3 w-3" /> 
      }
    };

    const config = statusConfig[status];
    return (
      <Badge className={`${config.color} flex items-center gap-1`} data-testid={`badge-status-${camera.id}`}>
        {config.icon}
        <span className="capitalize">{status}</span>
        {isRealTime && isWebSocketConnected && (
          <span className="text-xs opacity-75">●</span>
        )}
      </Badge>
    );
  };

  const getStatusIcon = (status: CameraStatus, isRealTime: boolean = false) => {
    const statusColors = {
      online: `bg-green-500 animate-pulse ${isRealTime ? 'ring-2 ring-green-400 ring-opacity-30' : ''}`,
      offline: `bg-red-500 ${isRealTime ? 'transition-all duration-300' : ''}`,
      maintenance: `bg-yellow-500 ${isRealTime ? 'transition-all duration-300' : ''}`,
      error: `bg-red-500 animate-pulse ${isRealTime ? 'ring-2 ring-red-400 ring-opacity-30' : ''}`
    };
    
    return <div className={`w-2 h-2 ${statusColors[status]} rounded-full transition-all duration-300`} />;
  };

  const getLastUpdate = () => {
    // Use real-time last seen if available, fallback to camera.lastHeartbeat
    if (lastSeenText && lastSeenText !== "Never") {
      return lastSeenText;
    }
    
    if (!camera.lastHeartbeat) return "Never";
    
    const lastHeartbeat = new Date(camera.lastHeartbeat);
    const now = new Date();
    const diffMs = now.getTime() - lastHeartbeat.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    
    if (diffSeconds < 60) return `${diffSeconds} seconds ago`;
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`;
    return `${diffHours} hours ago`;
  };

  return (
    <Card 
      className="overflow-hidden group hover:shadow-lg transition-shadow"
      data-testid={`card-camera-${camera.id}`}
      role="article"
      aria-label={`Camera ${camera.name} at ${camera.location}`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <CameraIcon className="h-5 w-5" aria-hidden="true" />
            <span data-testid={`text-camera-name-${camera.id}`}>{camera.name}</span>
          </CardTitle>
          {getStatusBadge(currentStatus, isWebSocketConnected && isVisible)}
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span data-testid={`text-camera-location-${camera.id}`}>{camera.location}</span>
          <div className="flex items-center gap-1">
            {getStatusIcon(currentStatus, isWebSocketConnected && isVisible)}
            <span data-testid={`text-camera-update-${camera.id}`}>{getLastUpdate()}</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Video Feed Area with Canvas Overlay Foundation */}
        <div 
          ref={videoRef}
          className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden"
        >
          {/* AI Detection Overlay Renderer */}
          <OverlayRenderer
            canvasRef={canvasRef}
            containerRef={videoRef}
            detections={cameraAnalysis.getRecentDetections()}
            getDetectionOpacity={cameraAnalysis.getDetectionOpacity}
            isVisible={tileState.showOverlay && tileState.analysisEnabled}
          />
          
          {/* Detection Stats Overlay */}
          {tileState.showOverlay && tileState.analysisEnabled && (
            <DetectionStats 
              detections={cameraAnalysis.getRecentDetections()}
              className="z-20"
            />
          )}

          {/* Canvas element for overlay rendering */}
          <canvas 
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
            data-testid={`canvas-overlay-${camera.id}`}
            aria-hidden="true"
          />
          
          {currentStatus === "online" ? (
            // Real streaming engine for online cameras
            <StreamingEngine
              camera={camera}
              width={640}
              height={360}
              autoPlay={tileState.isPlaying}
              muted={true}
              className="w-full h-full"
              onStreamStart={() => setTileState(prev => ({ ...prev, isLoading: false, hasError: false }))}
              onStreamEnd={() => setTileState(prev => ({ ...prev, isLoading: false }))}
              onStreamError={(error) => {
                console.error(`Camera ${camera.id} stream error:`, error);
                setTileState(prev => ({ ...prev, hasError: true, isLoading: false }));
              }}
              onStreamQualityUpdate={(metrics: StreamQualityMetrics) => {
                // Update camera quality metrics on the server
                console.log(`Camera ${camera.id} quality:`, metrics);
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-gray-700 flex items-center justify-center transition-all duration-500">
              <div className="text-center text-gray-400" data-testid={`offline-state-${camera.id}`}>
                <CameraIcon className="h-12 w-12 mx-auto mb-2" aria-hidden="true" />
                <p className="text-sm">
                  {currentStatus === "offline" 
                    ? "Camera Offline" 
                    : currentStatus === "maintenance" 
                    ? "Under Maintenance"
                    : "Camera Error"
                  }
                </p>
                {isWebSocketConnected && isVisible && (
                  <div className="mt-2 flex items-center justify-center gap-1 text-xs opacity-60">
                    <div className="w-1.5 h-1.5 bg-red-400 rounded-full" />
                    <span>Real-time</span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Camera Controls */}
          <CameraControls 
            camera={camera}
            currentStatus={currentStatus} // CRITICAL FIX: Pass real-time status to controls
            tileState={tileState}
            onPlay={handlePlay}
            onPause={handlePause}
            onFullscreen={handleFullscreen}
            onToggleOverlay={handleToggleOverlay}
            onToggleAnalysis={handleToggleAnalysis}
            analysisState={cameraAnalysis.analysisState}
          />
        </div>
      </CardContent>
    </Card>
  );
}

// Camera Grid Component  
interface CameraGridProps {
  cameras: Camera[];
  layout: GridLayout;
  isLoading: boolean;
  visibleCameraIds?: string[];
}

function CameraGrid({ cameras, layout, isLoading, visibleCameraIds = [] }: CameraGridProps) {
  const config = GRID_CONFIGS[layout];
  const displayedCameras = cameras.slice(0, config.maxItems);
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64" data-testid="loading-cameras">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading cameras...</p>
        </div>
      </div>
    );
  }

  if (cameras.length === 0) {
    return (
      <div className="text-center py-12" data-testid="empty-cameras">
        <CameraIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
        <h3 className="text-xl font-semibold mb-2">No Cameras Found</h3>
        <p className="text-muted-foreground">No cameras are configured for this location.</p>
      </div>
    );
  }

  return (
    <div 
      className={`grid ${config.cols} gap-6`}
      data-testid="grid-camera-layout"
      role="grid"
      aria-label={`Camera grid in ${layout} layout`}
    >
      {displayedCameras.map((camera) => (
        <div key={camera.id} role="gridcell" className={config.minTileSize}>
          <CameraTile 
            camera={camera} 
            isVisible={visibleCameraIds.includes(camera.id)}
          />
        </div>
      ))}
      
      {/* Fill empty grid slots for visual consistency */}
      {Array.from({ length: config.maxItems - displayedCameras.length }).map((_, index) => (
        <div 
          key={`empty-${index}`} 
          className={`${config.minTileSize} border-2 border-dashed border-muted rounded-lg flex items-center justify-center`}
          role="gridcell"
          aria-label="Empty camera slot"
          data-testid={`empty-slot-${index}`}
        >
          <div className="text-center text-muted-foreground">
            <CameraIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Camera Slot</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// Main Live Feeds Component
export default function LiveFeeds() {
  const { user } = useAuth();
  const [gridLayout, setGridLayout] = useState<GridLayout>("2x2");

  // Load grid layout preference from localStorage
  useEffect(() => {
    const savedLayout = localStorage.getItem(GRID_LAYOUT_STORAGE_KEY) as GridLayout | null;
    if (savedLayout && savedLayout in GRID_CONFIGS) {
      setGridLayout(savedLayout);
    }
  }, []);

  // Save grid layout preference to localStorage
  const handleLayoutChange = useCallback((newLayout: GridLayout) => {
    setGridLayout(newLayout);
    localStorage.setItem(GRID_LAYOUT_STORAGE_KEY, newLayout);
  }, []);

  // Calculate visible cameras based on current grid layout
  const config = GRID_CONFIGS[gridLayout];
  
  // Fetch camera data from API - initialize without WebSocket dependency
  const { data: cameras = [], isLoading, error, refetch } = useQuery<Camera[]>({
    queryKey: [`/api/store/${user?.storeId}/cameras`],
    enabled: !!user?.storeId,
    refetchInterval: 30000, // Will be adjusted based on WebSocket connection
    refetchIntervalInBackground: true,
    staleTime: 10000, // Will be adjusted based on WebSocket connection
  });

  const visibleCameras = cameras.slice(0, config.maxItems);
  const visibleCameraIds = visibleCameras.map(camera => camera.id);

  // Central camera status socket for performance optimization
  const { 
    cameraStatusState, 
    isWebSocketConnected, 
    initializeCameraStatuses,
    subscribedCameraCount 
  } = useCameraStatusSocket({
    enabled: !!user?.storeId && cameras.length > 0,
    visibleCameraIds: visibleCameraIds,
    heartbeatThreshold: 5 * 60_000 // CRITICAL FIX: 5 minutes in explicit milliseconds (300,000ms)
  });

  // Adjust polling frequency based on WebSocket connection
  useEffect(() => {
    if (isWebSocketConnected) {
      // Slower polling when WebSocket is connected
      refetch();
    }
  }, [isWebSocketConnected, refetch]);

  // Initialize camera statuses when cameras are loaded
  useEffect(() => {
    if (cameras.length > 0) {
      initializeCameraStatuses(cameras);
    }
  }, [cameras, initializeCameraStatuses]);

  // Calculate status counts using real-time data when available
  const getCameraStatusCounts = useCallback(() => {
    const counts = { online: 0, offline: 0, maintenance: 0, error: 0 };
    
    cameras.forEach(camera => {
      const realTimeStatus = cameraStatusState[camera.id];
      const status = realTimeStatus?.status || (camera.status as CameraStatus) || "offline";
      counts[status]++;
    });
    
    return counts;
  }, [cameras, cameraStatusState]);

  const statusCounts = getCameraStatusCounts();
  const onlineCameras = cameras.filter(c => {
    const realTimeStatus = cameraStatusState[c.id];
    const status = realTimeStatus?.status || (c.status as CameraStatus) || "offline";
    return status === "online";
  });
  const offlineCameras = cameras.filter(c => {
    const realTimeStatus = cameraStatusState[c.id];
    const status = realTimeStatus?.status || (c.status as CameraStatus) || "offline";
    return status === "offline";
  });
  const maintenanceCameras = cameras.filter(c => {
    const realTimeStatus = cameraStatusState[c.id];
    const status = realTimeStatus?.status || (c.status as CameraStatus) || "offline";
    return status === "maintenance";
  });

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case '1':
            event.preventDefault();
            handleLayoutChange("1x1");
            break;
          case '2':
            event.preventDefault();
            handleLayoutChange("2x2");
            break;
          case '3':
            event.preventDefault();
            handleLayoutChange("3x3");
            break;
          case '4':
            event.preventDefault();
            handleLayoutChange("4x4");
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleLayoutChange]);


  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">
            Live Camera Feeds
          </h1>
          <p className="text-muted-foreground">
            Real-time monitoring of all camera locations with configurable layouts
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Grid Layout Selector */}
          <GridSelector 
            currentLayout={gridLayout}
            onLayoutChange={handleLayoutChange}
            disabled={isLoading}
          />
          
          {/* Status Summary */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isWebSocketConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
              <span className="text-sm text-muted-foreground">
                {isWebSocketConnected ? 'Live' : 'Polling'}
              </span>
            </div>
            <Badge variant="outline" data-testid="badge-camera-summary">
              {onlineCameras.length}/{cameras.length} Online
            </Badge>
            {isWebSocketConnected && subscribedCameraCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {subscribedCameraCount} Subscribed
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Status Alerts */}
      <div className="space-y-2">
        {offlineCameras.length > 0 && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium" data-testid="alert-offline-cameras">
                {offlineCameras.length} camera(s) offline: {offlineCameras.map(c => c.name).join(', ')}
              </span>
            </div>
          </div>
        )}

        {maintenanceCameras.length > 0 && (
          <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
              <Settings className="h-4 w-4" />
              <span className="font-medium" data-testid="alert-maintenance-cameras">
                {maintenanceCameras.length} camera(s) under maintenance: {maintenanceCameras.map(c => c.name).join(', ')}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-300">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Failed to load cameras</span>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => refetch()}
              data-testid="button-retry-cameras"
            >
              Retry
            </Button>
          </div>
        </div>
      )}

      {/* Camera Grid */}
      <CameraGrid 
        cameras={cameras} 
        layout={gridLayout} 
        isLoading={isLoading}
        visibleCameraIds={visibleCameraIds}
      />

      {/* WebSocket Connection Status for Development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs text-muted-foreground">
          <div className="grid grid-cols-2 gap-2">
            <div>WebSocket: {isWebSocketConnected ? '✅ Connected' : '❌ Disconnected'}</div>
            <div>Subscribed Cameras: {subscribedCameraCount}</div>
            <div>Total Cameras: {cameras.length}</div>
            <div>Visible Cameras: {visibleCameraIds.length}</div>
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Help */}
      <div className="mt-8 text-sm text-muted-foreground">
        <p>
          <span className="font-medium">Keyboard shortcuts:</span> 
          <kbd className="ml-2 px-2 py-1 bg-muted rounded text-xs">Ctrl+1</kbd> 1×1 
          <kbd className="ml-2 px-2 py-1 bg-muted rounded text-xs">Ctrl+2</kbd> 2×2 
          <kbd className="ml-2 px-2 py-1 bg-muted rounded text-xs">Ctrl+3</kbd> 3×3 
          <kbd className="ml-2 px-2 py-1 bg-muted rounded text-xs">Ctrl+4</kbd> 4×4
        </p>
      </div>
    </div>
  );
}
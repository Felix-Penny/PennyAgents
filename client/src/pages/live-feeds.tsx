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
  Settings
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import type { Camera } from "@shared/schema";

// Types
type CameraStatus = "online" | "offline" | "maintenance" | "error";
type GridLayout = "1x1" | "2x2" | "3x3" | "4x4";

interface CameraTileState {
  isPlaying: boolean;
  isFullscreen: boolean;
  hasError: boolean;
  isLoading: boolean;
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
  tileState: CameraTileState;
  onPlay: () => void;
  onPause: () => void;
  onFullscreen: () => void;
}

function CameraControls({ camera, tileState, onPlay, onPause, onFullscreen }: CameraControlsProps) {
  const isOnline = camera.status === "online";
  
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
              <p>{tileState.isPlaying ? "Pause" : "Play"} analysis</p>
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
}

function CameraTile({ camera }: CameraTileProps) {
  const [tileState, setTileState] = useState<CameraTileState>({
    isPlaying: camera.status === "online",
    isFullscreen: false,
    hasError: false,
    isLoading: false
  });

  const handlePlay = useCallback(() => {
    setTileState(prev => ({ ...prev, isPlaying: true, isLoading: true }));
    // Simulate loading delay for video stream
    setTimeout(() => {
      setTileState(prev => ({ ...prev, isLoading: false }));
    }, 1000);
  }, []);

  const handlePause = useCallback(() => {
    setTileState(prev => ({ ...prev, isPlaying: false }));
  }, []);

  const videoRef = useRef<HTMLDivElement>(null);

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

  const getStatusBadge = (status: CameraStatus) => {
    const statusConfig = {
      online: { color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100", icon: <Wifi className="h-3 w-3" /> },
      offline: { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100", icon: <WifiOff className="h-3 w-3" /> },
      maintenance: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100", icon: <Settings className="h-3 w-3" /> },
      error: { color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100", icon: <AlertTriangle className="h-3 w-3" /> }
    };

    const config = statusConfig[status];
    return (
      <Badge className={`${config.color} flex items-center gap-1`} data-testid={`badge-status-${camera.id}`}>
        {config.icon}
        <span className="capitalize">{status}</span>
      </Badge>
    );
  };

  const getStatusIcon = (status: CameraStatus) => {
    const statusColors = {
      online: "bg-green-500 animate-pulse",
      offline: "bg-red-500",
      maintenance: "bg-yellow-500",
      error: "bg-red-500 animate-pulse"
    };
    
    return <div className={`w-2 h-2 ${statusColors[status]} rounded-full`} />;
  };

  const getLastUpdate = () => {
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
          {getStatusBadge(normalizeStatus(camera.status))}
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span data-testid={`text-camera-location-${camera.id}`}>{camera.location}</span>
          <div className="flex items-center gap-1">
            {getStatusIcon(normalizeStatus(camera.status))}
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
          {/* Canvas overlay for AI detection boxes - foundation for future enhancement */}
          <canvas 
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
            data-testid={`canvas-overlay-${camera.id}`}
            aria-hidden="true"
            style={{ display: 'none' }} // Hidden for now, ready for AI overlay integration
          />
          
          {camera.status === "online" ? (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
              {tileState.hasError ? (
                <div className="text-center text-red-400" data-testid={`error-state-${camera.id}`}>
                  <AlertTriangle className="h-12 w-12 mx-auto mb-2" />
                  <p className="text-sm">Stream Error</p>
                </div>
              ) : (
                <div className="text-center text-white">
                  <CameraIcon className="h-12 w-12 mx-auto mb-2 opacity-50" aria-hidden="true" />
                  <p className="text-sm opacity-75">
                    {tileState.isLoading ? "Loading..." : tileState.isPlaying ? "Live Feed" : "Paused"}
                  </p>
                  {tileState.isPlaying && !tileState.isLoading && (
                    <div className="mt-2 w-16 h-1 bg-red-500 mx-auto animate-pulse rounded" aria-hidden="true" />
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
              <div className="text-center text-gray-400" data-testid={`offline-state-${camera.id}`}>
                <CameraIcon className="h-12 w-12 mx-auto mb-2" aria-hidden="true" />
                <p className="text-sm">
                  {camera.status === "offline" 
                    ? "Camera Offline" 
                    : camera.status === "maintenance" 
                    ? "Under Maintenance"
                    : "Camera Error"
                  }
                </p>
              </div>
            </div>
          )}
          
          {/* Camera Controls */}
          <CameraControls 
            camera={camera}
            tileState={tileState}
            onPlay={handlePlay}
            onPause={handlePause}
            onFullscreen={handleFullscreen}
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
}

function CameraGrid({ cameras, layout, isLoading }: CameraGridProps) {
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
          <CameraTile camera={camera} />
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

  // Fetch camera data from API
  const { data: cameras = [], isLoading, error, refetch } = useQuery<Camera[]>({
    queryKey: [`/api/store/${user?.storeId}/cameras`],
    enabled: !!user?.storeId,
    refetchInterval: 30000, // Refetch every 30 seconds for status updates
    refetchIntervalInBackground: true,
    staleTime: 10000, // Consider data fresh for 10 seconds
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

  const onlineCameras = cameras.filter(c => c.status === "online");
  const offlineCameras = cameras.filter(c => c.status === "offline");
  const maintenanceCameras = cameras.filter(c => c.status === "maintenance");

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
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm text-muted-foreground">Live</span>
            </div>
            <Badge variant="outline" data-testid="badge-camera-summary">
              {onlineCameras.length}/{cameras.length} Online
            </Badge>
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
      <CameraGrid cameras={cameras} layout={gridLayout} isLoading={isLoading} />

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
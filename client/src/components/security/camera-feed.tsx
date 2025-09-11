import { Badge } from "@/components/ui/badge";
import { Camera } from "@shared/schema";
import { Video, AlertTriangle, User, Wifi, WifiOff } from "lucide-react";

interface CameraFeedProps {
  camera: Camera;
  hasAlert?: boolean;
  hasOffender?: boolean;
  showDetails?: boolean;
  compact?: boolean;
  className?: string;
}

export function CameraFeed({ 
  camera, 
  hasAlert = false, 
  hasOffender = false, 
  showDetails = false,
  compact = false,
  className = "" 
}: CameraFeedProps) {
  const isOnline = camera.status === 'online';
  
  return (
    <div className={`relative camera-feed rounded-lg ${compact ? 'h-12' : 'h-32'} group ${className}`}>
      {/* Camera feed placeholder with gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900 rounded-lg flex items-center justify-center">
        <div className="text-center">
          <Video className={`text-white/50 mb-2 mx-auto ${compact ? 'h-4 w-4' : 'h-6 w-6'}`} />
          {!compact && (
            <>
              <p className="text-white/70 text-xs">{camera.name}</p>
              <p className="text-white/50 text-xs">{camera.location}</p>
            </>
          )}
        </div>
      </div>
      
      {/* Detection overlays */}
      {hasAlert && !compact && (
        <div className="detection-overlay top-4 left-4 w-16 h-20"></div>
      )}
      
      {/* Camera Status */}
      <div className={`absolute ${compact ? 'top-1 right-1' : 'top-2 right-2'} flex items-center space-x-1`}>
        {isOnline ? (
          <Wifi className={`text-green-500 ${compact ? 'h-3 w-3' : 'h-4 w-4'}`} />
        ) : (
          <WifiOff className={`text-red-500 ${compact ? 'h-3 w-3' : 'h-4 w-4'}`} />
        )}
        {!compact && (
          <span className="text-white text-xs bg-black/50 px-1 rounded">
            {isOnline ? 'LIVE' : 'OFFLINE'}
          </span>
        )}
      </div>
      
      {/* Alert Badges */}
      {!compact && (
        <div className="absolute bottom-2 left-2 space-y-1">
          {hasAlert && (
            <Badge variant="destructive" className="text-xs animate-pulse">
              <AlertTriangle className="h-3 w-3 mr-1" />
              THEFT DETECTED
            </Badge>
          )}
          {hasOffender && (
            <Badge className="bg-yellow-500 text-black text-xs">
              <User className="h-3 w-3 mr-1" />
              KNOWN OFFENDER
            </Badge>
          )}
        </div>
      )}
      
      {/* Additional details for expanded view */}
      {showDetails && !compact && (
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
          <div className="text-center text-white">
            <p className="text-sm font-medium">{camera.name}</p>
            <p className="text-xs">{camera.location}</p>
            {camera.ipAddress && (
              <p className="text-xs opacity-75">{camera.ipAddress}</p>
            )}
            <Badge 
              variant={camera.status === 'online' ? 'default' : 'destructive'} 
              className="mt-2"
            >
              {camera.status}
            </Badge>
          </div>
        </div>
      )}
    </div>
  );
}

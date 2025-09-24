import { useState, useEffect, useCallback, useRef } from "react";
import { useWebSocket } from "@/lib/websocket";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import type { Camera } from "@shared/schema";

// Real-time camera status types
export type CameraStatus = "online" | "offline" | "maintenance" | "error";

export interface CameraStatusUpdate {
  cameraId: string;
  status: CameraStatus;
  lastSeen?: Date;
  timestamp: Date;
}

export interface CameraStatusState {
  [cameraId: string]: {
    status: CameraStatus;
    lastSeen?: Date;
    isConnected: boolean;
    lastUpdate: Date;
  };
}

interface UseCameraStatusSocketOptions {
  enabled?: boolean;
  visibleCameraIds?: string[]; // Only subscribe to visible cameras for performance
  heartbeatThreshold?: number; // CRITICAL FIX: Milliseconds before considering a camera offline (explicit units)
}

/**
 * Hook for real-time camera status updates via WebSocket
 * Provides live status monitoring with heartbeat tracking and performance optimizations
 */
export function useCameraStatusSocket(options: UseCameraStatusSocketOptions = {}) {
  const { 
    enabled = true, 
    visibleCameraIds = [], 
    heartbeatThreshold = 5 * 60_000 // CRITICAL FIX: 5 minutes in explicit milliseconds (300,000ms)
  } = options;
  
  const { user } = useAuth();
  const { socket, isConnected, sendMessage } = useWebSocket();
  const queryClient = useQueryClient();
  
  // Real-time camera status state
  const [cameraStatusState, setCameraStatusState] = useState<CameraStatusState>({});
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  
  // Track subscriptions to prevent duplicates
  const subscribedCameras = useRef<Set<string>>(new Set());
  const heartbeatCheckInterval = useRef<NodeJS.Timeout>();
  
  // Initialize camera status from existing data
  const initializeCameraStatuses = useCallback((cameras: Camera[]) => {
    const initialState: CameraStatusState = {};
    cameras.forEach(camera => {
      initialState[camera.id] = {
        status: (camera.status as CameraStatus) || "offline",
        lastSeen: camera.lastHeartbeat ? new Date(camera.lastHeartbeat) : undefined,
        isConnected: camera.status === "online",
        lastUpdate: new Date()
      };
    });
    setCameraStatusState(initialState);
  }, []);
  
  // Update camera status from WebSocket message
  const updateCameraStatus = useCallback((update: CameraStatusUpdate) => {
    setCameraStatusState(prev => ({
      ...prev,
      [update.cameraId]: {
        status: update.status,
        lastSeen: update.lastSeen || new Date(),
        isConnected: update.status === "online",
        lastUpdate: update.timestamp
      }
    }));
    setLastUpdateTime(new Date());
    
    // Invalidate specific camera query for consistency
    queryClient.invalidateQueries({ 
      queryKey: [`/api/store/${user?.storeId}/cameras`] 
    });
  }, [queryClient, user?.storeId]);
  
  // Check for offline cameras based on heartbeat threshold
  const checkHeartbeats = useCallback(() => {
    const now = new Date();
    const thresholdMs = heartbeatThreshold; // CRITICAL FIX: heartbeatThreshold is now in milliseconds
    
    setCameraStatusState(prev => {
      const updated = { ...prev };
      let hasChanges = false;
      
      Object.entries(updated).forEach(([cameraId, state]) => {
        if (state.lastSeen && state.status === "online") {
          const timeSinceLastSeen = now.getTime() - state.lastSeen.getTime();
          
          if (timeSinceLastSeen > thresholdMs) {
            updated[cameraId] = {
              ...state,
              status: "offline",
              isConnected: false,
              lastUpdate: now
            };
            hasChanges = true;
          }
        }
      });
      
      if (hasChanges) {
        setLastUpdateTime(now);
      }
      
      return updated;
    });
  }, [heartbeatThreshold]);
  
  // Subscribe to camera status updates for visible cameras
  const subscribeToCamera = useCallback((cameraId: string) => {
    if (!socket || !isConnected || !user?.storeId || subscribedCameras.current.has(cameraId)) {
      return;
    }
    
    sendMessage({
      type: 'subscribe_camera_status',
      storeId: user.storeId,
      cameraId,
      userId: user.id
    });
    
    subscribedCameras.current.add(cameraId);
  }, [socket, isConnected, sendMessage, user?.storeId, user?.id]);
  
  // Unsubscribe from camera status updates
  const unsubscribeFromCamera = useCallback((cameraId: string) => {
    if (!socket || !user?.storeId || !subscribedCameras.current.has(cameraId)) {
      return;
    }
    
    sendMessage({
      type: 'unsubscribe_camera_status',
      storeId: user.storeId,
      cameraId,
      userId: user.id
    });
    
    subscribedCameras.current.delete(cameraId);
  }, [socket, sendMessage, user?.storeId, user?.id]);
  
  // Subscribe to visible cameras when they change
  useEffect(() => {
    if (!enabled || !isConnected || !user?.storeId) {
      return;
    }
    
    // Subscribe to newly visible cameras
    visibleCameraIds.forEach(cameraId => {
      subscribeToCamera(cameraId);
    });
    
    // Unsubscribe from cameras no longer visible
    const currentSubscriptions = Array.from(subscribedCameras.current);
    currentSubscriptions.forEach(cameraId => {
      if (!visibleCameraIds.includes(cameraId)) {
        unsubscribeFromCamera(cameraId);
      }
    });
  }, [enabled, isConnected, visibleCameraIds, subscribeToCamera, unsubscribeFromCamera, user?.storeId]);
  
  // Setup WebSocket message handler
  useEffect(() => {
    if (!socket || !isConnected) {
      return;
    }
    
    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'camera_status_update':
            if (message.cameraId && message.status) {
              updateCameraStatus({
                cameraId: message.cameraId,
                status: message.status,
                lastSeen: message.lastSeen ? new Date(message.lastSeen) : undefined,
                timestamp: new Date(message.timestamp || Date.now())
              });
            }
            break;
            
          case 'camera_heartbeat':
            if (message.cameraId) {
              updateCameraStatus({
                cameraId: message.cameraId,
                status: "online",
                lastSeen: new Date(message.timestamp || Date.now()),
                timestamp: new Date(message.timestamp || Date.now())
              });
            }
            break;
            
          case 'camera_offline':
            if (message.cameraId) {
              updateCameraStatus({
                cameraId: message.cameraId,
                status: "offline",
                lastSeen: message.lastSeen ? new Date(message.lastSeen) : undefined,
                timestamp: new Date(message.timestamp || Date.now())
              });
            }
            break;
        }
      } catch (error) {
        console.error('Error parsing camera status WebSocket message:', error);
      }
    };
    
    // Add our message handler without interfering with existing ones
    const originalOnMessage = socket.onmessage;
    socket.onmessage = (event) => {
      // Call original handler first
      if (originalOnMessage) {
        originalOnMessage.call(socket, event);
      }
      // Then call our handler
      handleMessage(event);
    };
    
    return () => {
      if (socket.onmessage === handleMessage) {
        socket.onmessage = originalOnMessage;
      }
    };
  }, [socket, isConnected, updateCameraStatus]);
  
  // Setup heartbeat monitoring
  useEffect(() => {
    if (!enabled) {
      return;
    }
    
    // Check heartbeats every minute
    heartbeatCheckInterval.current = setInterval(checkHeartbeats, 60 * 1000);
    
    return () => {
      if (heartbeatCheckInterval.current) {
        clearInterval(heartbeatCheckInterval.current);
      }
    };
  }, [enabled, checkHeartbeats]);
  
  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      // Unsubscribe from all cameras on unmount
      subscribedCameras.current.forEach(cameraId => {
        unsubscribeFromCamera(cameraId);
      });
      subscribedCameras.current.clear();
      
      if (heartbeatCheckInterval.current) {
        clearInterval(heartbeatCheckInterval.current);
      }
    };
  }, [unsubscribeFromCamera]);
  
  // Get status for a specific camera
  const getCameraStatus = useCallback((cameraId: string) => {
    return cameraStatusState[cameraId] || {
      status: "offline" as CameraStatus,
      isConnected: false,
      lastUpdate: new Date()
    };
  }, [cameraStatusState]);
  
  // Get formatted last seen time
  const getLastSeenText = useCallback((cameraId: string): string => {
    const camera = cameraStatusState[cameraId];
    if (!camera?.lastSeen) {
      return "Never";
    }
    
    const now = new Date();
    const diffMs = now.getTime() - camera.lastSeen.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    
    if (diffMinutes < 1) {
      return "Just now";
    } else if (diffMinutes === 1) {
      return "1 minute ago";
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minutes ago`;
    } else {
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours === 1) {
        return "1 hour ago";
      } else if (diffHours < 24) {
        return `${diffHours} hours ago`;
      } else {
        const diffDays = Math.floor(diffHours / 24);
        return diffDays === 1 ? "1 day ago" : `${diffDays} days ago`;
      }
    }
  }, [cameraStatusState]);
  
  return {
    // Real-time status state
    cameraStatusState,
    lastUpdateTime,
    
    // WebSocket connection state
    isWebSocketConnected: isConnected,
    
    // Camera-specific utilities
    getCameraStatus,
    getLastSeenText,
    initializeCameraStatuses,
    
    // Manual subscription controls
    subscribeToCamera,
    unsubscribeFromCamera,
    
    // Performance metrics
    subscribedCameraCount: subscribedCameras.current.size,
    subscribedCameraIds: Array.from(subscribedCameras.current)
  };
}
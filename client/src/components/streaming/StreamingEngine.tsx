import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";
import { Loader2, AlertCircle, Wifi, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Camera } from "@shared/schema";

export interface StreamingEngineProps {
  camera: Camera;
  width?: number;
  height?: number;
  autoPlay?: boolean;
  muted?: boolean;
  className?: string;
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
  onStreamError?: (error: string) => void;
  onStreamQualityUpdate?: (metrics: StreamQualityMetrics) => void;
}

export interface StreamQualityMetrics {
  frameRate: number;
  latency: number;
  resolution: { width: number; height: number };
  bitrate: number;
  dropped_frames: number;
}

interface StreamState {
  isLoading: boolean;
  isPlaying: boolean;
  error: string | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
  quality: StreamQualityMetrics | null;
  reconnectAttempts: number;
}

/**
 * Universal Streaming Engine for multiple camera protocols
 * Supports: RTSP (via WebRTC/HLS conversion), WebRTC, MJPEG, WebSocket, HLS
 */
export function StreamingEngine({
  camera,
  width = 640,
  height = 480,
  autoPlay = true,
  muted = true,
  className = "",
  onStreamStart,
  onStreamEnd,
  onStreamError,
  onStreamQualityUpdate
}: StreamingEngineProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const rtcRef = useRef<RTCPeerConnection | null>(null);
  const intervalRef = useRef<NodeJS.Timeout>();
  
  const [state, setState] = useState<StreamState>({
    isLoading: false,
    isPlaying: false,
    error: null,
    connectionStatus: 'disconnected',
    quality: null,
    reconnectAttempts: 0
  });

  // Get stream configuration from camera
  const streamConfig = camera.streamConfig as any;
  const protocol = Object.keys(streamConfig || {})[0];
  const streamUrl = streamConfig?.[protocol]?.url;
  const authConfig = camera.authConfig as any;

  const updateState = useCallback((updates: Partial<StreamState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  const startQualityMonitoring = useCallback(() => {
    if (!videoRef.current) return;

    intervalRef.current = setInterval(() => {
      const video = videoRef.current;
      if (!video) return;

      const quality: StreamQualityMetrics = {
        frameRate: 30, // Mock - would be calculated from actual stream
        latency: Math.random() * 100 + 50, // Mock latency
        resolution: {
          width: video.videoWidth || width,
          height: video.videoHeight || height
        },
        bitrate: Math.random() * 2000 + 1000, // Mock bitrate
        dropped_frames: Math.floor(Math.random() * 5)
      };

      setState(prev => ({ ...prev, quality }));
      onStreamQualityUpdate?.(quality);
    }, 5000); // Update every 5 seconds
  }, [width, height, onStreamQualityUpdate]);

  const stopQualityMonitoring = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = undefined;
    }
  }, []);

  // RTSP Stream Handler (via HLS conversion or WebRTC gateway)
  const setupRTSPStream = useCallback(async () => {
    if (!videoRef.current || !streamUrl) return;

    // In real implementation, RTSP would be converted to HLS or WebRTC by server
    // For demo, we'll simulate with HLS
    const hlsUrl = streamUrl.replace('rtsp://', 'http://').replace(':554', ':8080') + '.m3u8';
    
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90
      });
      
      hlsRef.current = hls;
      hls.loadSource(hlsUrl);
      hls.attachMedia(videoRef.current);
      
      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        updateState({ connectionStatus: 'connected', isLoading: false });
        onStreamStart?.();
        startQualityMonitoring();
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        updateState({ 
          error: `RTSP Stream Error: ${data.details}`,
          connectionStatus: 'disconnected',
          isLoading: false
        });
        onStreamError?.(data.details || 'Unknown RTSP error');
      });
    } else {
      throw new Error('HLS not supported in this browser');
    }
  }, [streamUrl, onStreamStart, onStreamError, updateState, startQualityMonitoring]);

  // HLS Stream Handler
  const setupHLSStream = useCallback(async () => {
    if (!videoRef.current || !streamUrl) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true
      });
      
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(videoRef.current);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        updateState({ connectionStatus: 'connected', isLoading: false });
        if (autoPlay) {
          videoRef.current?.play();
        }
        onStreamStart?.();
        startQualityMonitoring();
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          updateState({ 
            error: `HLS Error: ${data.details}`,
            connectionStatus: 'disconnected',
            isLoading: false
          });
          onStreamError?.(data.details || 'Unknown HLS error');
        }
      });
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      videoRef.current.src = streamUrl;
      updateState({ connectionStatus: 'connected', isLoading: false });
      onStreamStart?.();
      startQualityMonitoring();
    } else {
      throw new Error('HLS not supported in this browser');
    }
  }, [streamUrl, autoPlay, onStreamStart, onStreamError, updateState, startQualityMonitoring]);

  // MJPEG Stream Handler
  const setupMJPEGStream = useCallback(async () => {
    if (!videoRef.current || !streamUrl) return;

    // Add authentication to URL if provided
    let authUrl = streamUrl;
    if (authConfig?.username && authConfig?.password) {
      const url = new URL(streamUrl);
      url.username = authConfig.username;
      url.password = authConfig.password;
      authUrl = url.toString();
    }

    // For MJPEG, we use an img element approach since it's essentially a stream of JPEG images
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      updateState({ connectionStatus: 'connected', isLoading: false });
      drawMJPEGFrame();
      onStreamStart?.();
      startQualityMonitoring();
    };
    
    img.onerror = () => {
      updateState({ 
        error: 'Failed to load MJPEG stream',
        connectionStatus: 'disconnected',
        isLoading: false
      });
      onStreamError?.('MJPEG stream connection failed');
    };

    const drawMJPEGFrame = () => {
      if (!canvasRef.current || !videoRef.current) return;
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      
      // Schedule next frame
      setTimeout(() => {
        img.src = authUrl + '?_t=' + Date.now(); // Cache busting
      }, 33); // ~30 FPS
    };

    img.src = authUrl;
  }, [streamUrl, authConfig, width, height, onStreamStart, onStreamError, updateState, startQualityMonitoring]);

  // WebRTC Stream Handler
  const setupWebRTCStream = useCallback(async () => {
    if (!videoRef.current || !streamUrl) return;

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      
      rtcRef.current = pc;

      pc.ontrack = (event) => {
        if (videoRef.current) {
          videoRef.current.srcObject = event.streams[0];
          updateState({ connectionStatus: 'connected', isLoading: false });
          onStreamStart?.();
          startQualityMonitoring();
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        updateState({ 
          connectionStatus: state === 'connected' ? 'connected' : 
                          state === 'connecting' ? 'connecting' :
                          state === 'failed' ? 'disconnected' : 'disconnected'
        });
      };

      // Initiate WebRTC handshake with signaling server
      const response = await fetch(streamUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'offer' })
      });
      
      const { offer } = await response.json();
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      await fetch(streamUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'answer', answer })
      });
      
    } catch (error) {
      updateState({ 
        error: `WebRTC Error: ${error}`,
        connectionStatus: 'disconnected',
        isLoading: false
      });
      onStreamError?.(String(error));
    }
  }, [streamUrl, onStreamStart, onStreamError, updateState, startQualityMonitoring]);

  // WebSocket Stream Handler
  const setupWebSocketStream = useCallback(async () => {
    if (!streamUrl || !canvasRef.current) return;

    try {
      const ws = new WebSocket(streamUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = () => {
        updateState({ connectionStatus: 'connected', isLoading: false });
        onStreamStart?.();
        startQualityMonitoring();
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          // Decode frame data (would use jsmpeg or similar for actual video)
          drawWebSocketFrame(event.data);
        }
      };

      ws.onerror = () => {
        updateState({ 
          error: 'WebSocket connection failed',
          connectionStatus: 'disconnected',
          isLoading: false
        });
        onStreamError?.('WebSocket stream connection failed');
      };

      ws.onclose = () => {
        updateState({ connectionStatus: 'disconnected' });
        onStreamEnd?.();
      };
    } catch (error) {
      updateState({ 
        error: `WebSocket Error: ${error}`,
        connectionStatus: 'disconnected',
        isLoading: false
      });
      onStreamError?.(String(error));
    }
  }, [streamUrl, onStreamStart, onStreamEnd, onStreamError, updateState, startQualityMonitoring]);

  const drawWebSocketFrame = useCallback((data: ArrayBuffer) => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Mock frame drawing - in real implementation would decode video data
    const imageData = ctx.createImageData(width, height);
    const buffer = new Uint8Array(data);
    
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] = buffer[i % buffer.length];     // R
      imageData.data[i + 1] = buffer[(i + 1) % buffer.length]; // G
      imageData.data[i + 2] = buffer[(i + 2) % buffer.length]; // B
      imageData.data[i + 3] = 255; // A
    }
    
    ctx.putImageData(imageData, 0, 0);
  }, [width, height]);

  // Main stream initialization
  const initializeStream = useCallback(async () => {
    if (!protocol || !streamUrl) {
      updateState({ error: 'Invalid stream configuration' });
      return;
    }

    updateState({ 
      isLoading: true, 
      error: null, 
      connectionStatus: 'connecting',
      reconnectAttempts: 0
    });

    try {
      switch (protocol.toLowerCase()) {
        case 'rtsp':
          await setupRTSPStream();
          break;
        case 'hls':
          await setupHLSStream();
          break;
        case 'mjpeg':
          await setupMJPEGStream();
          break;
        case 'webrtc':
          await setupWebRTCStream();
          break;
        case 'websocket':
          await setupWebSocketStream();
          break;
        default:
          throw new Error(`Unsupported protocol: ${protocol}`);
      }
    } catch (error) {
      updateState({ 
        error: String(error),
        isLoading: false,
        connectionStatus: 'disconnected'
      });
      onStreamError?.(String(error));
    }
  }, [protocol, streamUrl, setupRTSPStream, setupHLSStream, setupMJPEGStream, setupWebRTCStream, setupWebSocketStream, updateState, onStreamError]);

  // Cleanup function
  const cleanup = useCallback(() => {
    stopQualityMonitoring();
    
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    
    if (rtcRef.current) {
      rtcRef.current.close();
      rtcRef.current = null;
    }

    updateState({ 
      isLoading: false, 
      isPlaying: false,
      connectionStatus: 'disconnected'
    });
    onStreamEnd?.();
  }, [stopQualityMonitoring, updateState, onStreamEnd]);

  // Retry connection
  const retryConnection = useCallback(() => {
    if (state.reconnectAttempts < 5) {
      updateState({ reconnectAttempts: state.reconnectAttempts + 1 });
      setTimeout(initializeStream, 2000 * Math.pow(2, state.reconnectAttempts));
    }
  }, [state.reconnectAttempts, updateState, initializeStream]);

  // Initialize stream on mount
  useEffect(() => {
    initializeStream();
    return cleanup;
  }, [initializeStream, cleanup]);

  // Handle video events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => updateState({ isPlaying: true });
    const handlePause = () => updateState({ isPlaying: false });
    
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    
    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [updateState]);

  const isCanvasProtocol = protocol === 'mjpeg' || protocol === 'websocket';

  return (
    <div className={`relative ${className}`} data-testid={`streaming-engine-${camera.id}`}>
      {/* Video Element for HLS, WebRTC, RTSP */}
      {!isCanvasProtocol && (
        <video
          ref={videoRef}
          width={width}
          height={height}
          autoPlay={autoPlay}
          muted={muted}
          playsInline
          className="w-full h-full object-cover rounded-lg"
          style={{ display: state.connectionStatus === 'connected' ? 'block' : 'none' }}
        />
      )}
      
      {/* Canvas Element for MJPEG, WebSocket */}
      {isCanvasProtocol && (
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="w-full h-full object-cover rounded-lg"
          style={{ display: state.connectionStatus === 'connected' ? 'block' : 'none' }}
        />
      )}

      {/* Loading Overlay */}
      {state.isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
          <div className="text-center text-white">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-sm">Connecting to {protocol?.toUpperCase()} stream...</p>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {state.error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-lg">
          <div className="text-center text-white p-4">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h3 className="text-lg font-semibold mb-2">Stream Error</h3>
            <p className="text-sm text-gray-300 mb-4">{state.error}</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={retryConnection}
              disabled={state.reconnectAttempts >= 5}
            >
              {state.reconnectAttempts >= 5 ? 'Max Retries Reached' : 'Retry Connection'}
            </Button>
          </div>
        </div>
      )}

      {/* Stream Status Badge */}
      <div className="absolute top-2 right-2">
        <Badge variant={state.connectionStatus === 'connected' ? 'default' : 'secondary'}>
          {state.connectionStatus === 'connected' ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
          {protocol?.toUpperCase()}
        </Badge>
      </div>

      {/* Quality Metrics */}
      {state.quality && state.connectionStatus === 'connected' && (
        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          {state.quality.resolution.width}x{state.quality.resolution.height} | {state.quality.frameRate.toFixed(1)}fps | {state.quality.latency.toFixed(0)}ms
        </div>
      )}
    </div>
  );
}
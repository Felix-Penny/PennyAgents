import { useState, useEffect, useCallback, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useVisibilityOptimization } from "./useVisibilityOptimization";
import type { DetectionResult, DetectionBoundingBox, ThreatSeverity } from "@shared/schema";

// Frame capture utility to convert canvas/video frames to JPEG blobs
export class FrameCapture {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * Capture frame from video element as base64 JPEG data URL
   */
  async captureVideoFrame(videoElement: HTMLVideoElement): Promise<string | null> {
    if (!videoElement || videoElement.readyState < 2) {
      return null; // Video not ready
    }

    try {
      // Set canvas dimensions to match video
      this.canvas.width = videoElement.videoWidth || videoElement.clientWidth;
      this.canvas.height = videoElement.videoHeight || videoElement.clientHeight;

      if (this.canvas.width === 0 || this.canvas.height === 0) {
        return null; // Invalid dimensions
      }

      // Draw current video frame to canvas
      this.ctx.drawImage(videoElement, 0, 0, this.canvas.width, this.canvas.height);

      // Convert to JPEG with 0.8 quality for balance of size/quality
      return this.canvas.toDataURL('image/jpeg', 0.8);
    } catch (error) {
      console.error('Frame capture failed:', error);
      return null;
    }
  }

  /**
   * Create a mock frame for development/testing when no video is available
   */
  createMockFrame(width: number = 640, height: number = 480): string {
    this.canvas.width = width;
    this.canvas.height = height;

    // Create a gradient background
    const gradient = this.ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#1a1a1a');
    gradient.addColorStop(1, '#333333');
    
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, width, height);

    // Add some mock elements
    this.ctx.fillStyle = '#666';
    this.ctx.fillRect(50, 50, 100, 80); // Mock person
    this.ctx.fillRect(200, 150, 60, 40); // Mock object
    
    this.ctx.fillStyle = '#888';
    this.ctx.font = '12px monospace';
    this.ctx.fillText(`Mock Camera Feed ${Date.now()}`, 10, height - 10);

    return this.canvas.toDataURL('image/jpeg', 0.8);
  }

  dispose() {
    // Clean up canvas resources
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}

// Detection cache for managing recent detection results with fade-out
export class DetectionCache {
  private cache = new Map<string, CachedDetection>();
  private fadeOutDuration: number;
  private maxCacheSize: number;

  constructor(fadeOutDurationMs: number = 5000, maxCacheSize: number = 50) {
    this.fadeOutDuration = fadeOutDurationMs;
    this.maxCacheSize = maxCacheSize;
  }

  addDetection(cameraId: string, result: DetectionResult) {
    const key = `${cameraId}_${result.ts}`;
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
      cameraId
    });

    this.cleanup();
  }

  getRecentDetections(cameraId: string): DetectionResult[] {
    const now = Date.now();
    const recent: DetectionResult[] = [];

    for (const [key, cached] of Array.from(this.cache.entries())) {
      if (cached.cameraId === cameraId && 
          (now - cached.timestamp) < this.fadeOutDuration) {
        recent.push(cached.result);
      }
    }

    return recent.sort((a, b) => b.ts - a.ts); // Most recent first
  }

  getDetectionOpacity(detection: DetectionResult): number {
    const cached = Array.from(this.cache.values()).find(c => c.result.ts === detection.ts);
    if (!cached) return 0;

    const age = Date.now() - cached.timestamp;
    const fadeRatio = Math.max(0, 1 - (age / this.fadeOutDuration));
    return fadeRatio * 0.8; // Max opacity of 0.8
  }

  private cleanup() {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, cached] of Array.from(this.cache.entries())) {
      if ((now - cached.timestamp) > this.fadeOutDuration) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach(key => this.cache.delete(key));

    // Enforce max cache size
    if (this.cache.size > this.maxCacheSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp); // Oldest first
      
      const toDelete = entries.slice(0, this.cache.size - this.maxCacheSize);
      toDelete.forEach(([key]) => this.cache.delete(key));
    }
  }

  clear(cameraId?: string) {
    if (cameraId) {
      for (const [key, cached] of Array.from(this.cache.entries())) {
        if (cached.cameraId === cameraId) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }
}

interface CachedDetection {
  result: DetectionResult;
  timestamp: number;
  cameraId: string;
}

// Analysis state and configuration
export interface CameraAnalysisConfig {
  throttleMs?: number; // Throttle between analyses (default: 1000ms = 1 FPS)
  confidenceThreshold?: number; // Minimum confidence for displaying detections
  enableThreatDetection?: boolean;
  enableBehaviorAnalysis?: boolean;
  enableObjectDetection?: boolean;
}

export interface CameraAnalysisState {
  isAnalyzing: boolean;
  isEnabled: boolean;
  lastAnalysisTime: number;
  detectionCount: number;
  errorCount: number;
  lastError: string | null;
  concurrentAnalyses: number;
}

// Global concurrent analysis manager
class ConcurrentAnalysisManager {
  private maxConcurrent: number;
  private currentCount: number = 0;
  private queue: Array<() => void> = [];

  constructor(maxConcurrent: number = 4) {
    this.maxConcurrent = maxConcurrent;
  }

  async executeAnalysis<T>(analysisFunction: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        this.currentCount++;
        try {
          const result = await analysisFunction();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.currentCount--;
          this.processQueue();
        }
      };

      if (this.currentCount < this.maxConcurrent) {
        execute();
      } else {
        this.queue.push(execute);
      }
    });
  }

  private processQueue() {
    if (this.queue.length > 0 && this.currentCount < this.maxConcurrent) {
      const nextExecution = this.queue.shift();
      if (nextExecution) {
        nextExecution();
      }
    }
  }

  getCurrentCount(): number {
    return this.currentCount;
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

// Global instance
const concurrentAnalysisManager = new ConcurrentAnalysisManager(4);

/**
 * useCameraAnalysis Hook
 * 
 * Provides throttled frame capture and AI analysis for camera tiles
 */
export function useCameraAnalysis(
  cameraId: string,
  storeId: string,
  videoElementRef: React.RefObject<HTMLVideoElement | HTMLDivElement>,
  config: CameraAnalysisConfig = {}
) {
  // Configuration with defaults
  const throttleMs = config.throttleMs || 1000; // 1 FPS default
  const confidenceThreshold = config.confidenceThreshold || 0.3;

  // Visibility optimization
  const visibility = useVisibilityOptimization(videoElementRef);

  // State
  const [analysisState, setAnalysisState] = useState<CameraAnalysisState>({
    isAnalyzing: false,
    isEnabled: false,
    lastAnalysisTime: 0,
    detectionCount: 0,
    errorCount: 0,
    lastError: null,
    concurrentAnalyses: 0
  });

  // Detection cache and frame capture instances
  const detectionCacheRef = useRef<DetectionCache>(new DetectionCache());
  const frameCaptureRef = useRef<FrameCapture>(new FrameCapture());
  const analysisIntervalRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController>();

  /**
   * Perform a single frame analysis
   */
  const performAnalysis = useCallback(async (): Promise<DetectionResult | null> => {
    if (!analysisState.isEnabled || analysisState.isAnalyzing) {
      return null;
    }

    // Skip analysis if tile is not visible (performance optimization)
    if (!visibility.isVisible) {
      return null;
    }

    // Check throttle
    const now = Date.now();
    if (now - analysisState.lastAnalysisTime < throttleMs) {
      return null;
    }

    const videoElement = videoElementRef.current;
    if (!videoElement) return null;

    try {
      setAnalysisState(prev => ({ ...prev, isAnalyzing: true, concurrentAnalyses: concurrentAnalysisManager.getCurrentCount() }));

      // Capture frame - handle both video elements and divs (for mock feeds)
      let frameData: string | null = null;
      
      if (videoElement instanceof HTMLVideoElement) {
        frameData = await frameCaptureRef.current.captureVideoFrame(videoElement);
      } else {
        // For mock/placeholder feeds, create a mock frame
        frameData = frameCaptureRef.current.createMockFrame();
      }

      if (!frameData) {
        throw new Error('Failed to capture frame data');
      }

      // Perform AI analysis with concurrent limit management
      const result = await concurrentAnalysisManager.executeAnalysis(async () => {
        const response = await apiRequest('POST', '/api/ai/analyze-frame', {
          body: JSON.stringify({
            imageData: frameData,
            storeId,
            cameraId,
            config: {
              confidenceThreshold,
              enableThreatDetection: config.enableThreatDetection !== false,
              enableBehaviorAnalysis: config.enableBehaviorAnalysis !== false,
              enableObjectDetection: config.enableObjectDetection !== false,
            }
          }),
          signal: abortControllerRef.current?.signal
        });

        if (!response.ok) {
          const errorData = await response.text();
          throw new Error(`Analysis failed: ${response.status} ${errorData}`);
        }

        return await response.json();
      });

      // Filter detections by confidence threshold
      const filteredBoxes = result.boxes.filter(
        (box: DetectionBoundingBox) => box.confidence >= confidenceThreshold
      );

      const detectionResult: DetectionResult = {
        ...result,
        boxes: filteredBoxes,
        ts: now
      };

      // Cache the detection result
      detectionCacheRef.current.addDetection(cameraId, detectionResult);

      // Update state
      setAnalysisState(prev => ({
        ...prev,
        lastAnalysisTime: now,
        detectionCount: prev.detectionCount + 1,
        lastError: null,
        concurrentAnalyses: concurrentAnalysisManager.getCurrentCount()
      }));

      return detectionResult;

    } catch (error: any) {
      console.error('Camera analysis error:', error);
      
      // Handle rate limiting specifically
      if (error.message?.includes('429') || error.message?.includes('rate limit')) {
        console.warn('Rate limit hit, will retry later');
      }

      setAnalysisState(prev => ({
        ...prev,
        errorCount: prev.errorCount + 1,
        lastError: error.message || 'Analysis failed',
        concurrentAnalyses: concurrentAnalysisManager.getCurrentCount()
      }));
      return null;
    } finally {
      setAnalysisState(prev => ({ ...prev, isAnalyzing: false }));
    }
  }, [cameraId, storeId, videoElementRef, throttleMs, confidenceThreshold, config, analysisState.isEnabled, analysisState.isAnalyzing, analysisState.lastAnalysisTime, visibility.isVisible]);

  /**
   * Start continuous analysis
   */
  const startAnalysis = useCallback(() => {
    if (analysisState.isEnabled) return;

    console.log(`Starting camera analysis for ${cameraId}`);
    setAnalysisState(prev => ({ ...prev, isEnabled: true, lastError: null }));

    // Create abort controller for this analysis session
    abortControllerRef.current = new AbortController();

    // Start analysis loop
    analysisIntervalRef.current = setInterval(() => {
      performAnalysis();
    }, Math.max(throttleMs, 500)); // Minimum 500ms between attempts

  }, [analysisState.isEnabled, cameraId, throttleMs, performAnalysis]);

  /**
   * Stop continuous analysis
   */
  const stopAnalysis = useCallback(() => {
    console.log(`Stopping camera analysis for ${cameraId}`);
    
    setAnalysisState(prev => ({ ...prev, isEnabled: false, isAnalyzing: false }));

    if (analysisIntervalRef.current) {
      clearInterval(analysisIntervalRef.current);
      analysisIntervalRef.current = undefined;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = undefined;
    }

  }, [cameraId]);

  /**
   * Get recent detections for overlay rendering
   */
  const getRecentDetections = useCallback(() => {
    return detectionCacheRef.current.getRecentDetections(cameraId);
  }, [cameraId]);

  /**
   * Get detection opacity for fade-out effect
   */
  const getDetectionOpacity = useCallback((detection: DetectionResult) => {
    return detectionCacheRef.current.getDetectionOpacity(detection);
  }, []);

  /**
   * Clear detection cache
   */
  const clearDetections = useCallback(() => {
    detectionCacheRef.current.clear(cameraId);
  }, [cameraId]);

  /**
   * Perform single manual analysis (for testing)
   */
  const triggerAnalysis = useCallback(async () => {
    return performAnalysis();
  }, [performAnalysis]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAnalysis();
      frameCaptureRef.current.dispose();
      detectionCacheRef.current.clear(cameraId);
    };
  }, [cameraId, stopAnalysis]);

  // Handle page visibility changes (pause when hidden)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && analysisState.isEnabled) {
        console.log('Page hidden, pausing camera analysis');
        stopAnalysis();
      }
      // Note: Don't auto-resume when visible, let user control this
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [analysisState.isEnabled, stopAnalysis]);

  return {
    // State
    analysisState,
    
    // Actions
    startAnalysis,
    stopAnalysis,
    triggerAnalysis,
    
    // Data
    getRecentDetections,
    getDetectionOpacity,
    clearDetections,
    
    // Utilities (for external components)
    frameCapture: frameCaptureRef.current,
    detectionCache: detectionCacheRef.current
  };
}
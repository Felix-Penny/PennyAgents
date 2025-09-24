/**
 * BehavioralOverlay - Real-time behavioral pattern overlay system for camera feeds
 * Integrates with existing OverlayRenderer to show behavioral baselines, anomalies, and pattern indicators
 */

import { useRef, useEffect, useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "@/hooks/use-websocket";
import { 
  Brain, AlertTriangle, Target, Activity, TrendingUp, 
  Eye, Zap, Shield, MapPin, Timer
} from "lucide-react";

export interface BehavioralOverlayProps {
  cameraId: string;
  storeId: string;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  containerRef: React.RefObject<HTMLElement>;
  isVisible?: boolean;
  showBaselines?: boolean;
  showAnomalies?: boolean;
  showConfidenceScores?: boolean;
  className?: string;
}

interface BehavioralIndicator {
  id: string;
  type: 'baseline' | 'anomaly' | 'pattern';
  severity: 'low' | 'medium' | 'high' | 'critical';
  position: { x: number; y: number; width: number; height: number };
  confidence: number;
  deviationScore?: number;
  label: string;
  description: string;
  timestamp: Date;
  area?: string;
  eventType?: string;
}

interface BehavioralData {
  baselines: any[];
  anomalies: any[];
  recentEvents: any[];
  areaStatus: Record<string, {
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    eventCount: number;
    anomalyCount: number;
    confidence: number;
  }>;
}

/**
 * BehavioralOverlay Component
 * 
 * Renders behavioral pattern indicators on camera feeds with baseline and anomaly visualization
 */
export function BehavioralOverlay({
  cameraId,
  storeId,
  canvasRef,
  containerRef,
  isVisible = true,
  showBaselines = true,
  showAnomalies = true,
  showConfidenceScores = true,
  className = ""
}: BehavioralOverlayProps) {
  
  const animationFrameRef = useRef<number>();
  const [indicators, setIndicators] = useState<BehavioralIndicator[]>([]);

  // WebSocket connection for real-time behavioral updates
  const { isConnected, lastMessage } = useWebSocket("/behavioral/realtime");

  // Query behavioral data for this camera
  const { data: behavioralData, refetch } = useQuery<BehavioralData>({
    queryKey: ['/api/behavioral/camera-data', { cameraId, storeId }],
    refetchInterval: 10000, // Refresh every 10 seconds
    enabled: isVisible && !!cameraId && !!storeId,
  });

  // Real-time updates from WebSocket
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'behavioral_update' && lastMessage.cameraId === cameraId) {
      refetch();
    }
  }, [lastMessage, cameraId, refetch]);

  // Process behavioral data into visual indicators
  const processBehavioralData = useCallback(() => {
    if (!behavioralData) return [];

    const newIndicators: BehavioralIndicator[] = [];

    // Process baselines if enabled
    if (showBaselines && behavioralData.baselines) {
      behavioralData.baselines.forEach((baseline, index) => {
        // Create baseline indicators for different areas
        const area = baseline.area || `area_${index}`;
        const position = getAreaPosition(area, index);
        
        newIndicators.push({
          id: `baseline_${baseline.id || index}`,
          type: 'baseline',
          severity: getBaselineSeverity(baseline),
          position,
          confidence: baseline.confidence || 0.8,
          label: `Baseline: ${baseline.eventType?.replace(/_/g, ' ') || 'Normal Pattern'}`,
          description: `Expected behavior for ${area.replace(/_/g, ' ')}`,
          timestamp: new Date(),
          area: baseline.area,
          eventType: baseline.eventType
        });
      });
    }

    // Process anomalies if enabled
    if (showAnomalies && behavioralData.anomalies) {
      behavioralData.anomalies.forEach((anomaly, index) => {
        const area = anomaly.area || `area_${index}`;
        const position = getAreaPosition(area, index, true); // Slightly offset for anomalies
        
        newIndicators.push({
          id: `anomaly_${anomaly.id || index}`,
          type: 'anomaly',
          severity: anomaly.severity || 'medium',
          position,
          confidence: anomaly.confidence || 0.7,
          deviationScore: anomaly.deviationScore,
          label: `Anomaly: ${getSeverityLabel(anomaly.severity)}`,
          description: anomaly.description || 'Behavioral anomaly detected',
          timestamp: new Date(anomaly.timestamp),
          area: anomaly.area
        });
      });
    }

    // Process area status indicators
    if (behavioralData.areaStatus) {
      Object.entries(behavioralData.areaStatus).forEach(([area, status], index) => {
        if (status.riskLevel !== 'low') { // Only show medium/high/critical risk areas
          const position = getAreaPosition(area, index + 10); // Offset to avoid conflicts
          
          newIndicators.push({
            id: `area_status_${area}`,
            type: 'pattern',
            severity: status.riskLevel,
            position,
            confidence: status.confidence,
            label: `Area Risk: ${status.riskLevel.toUpperCase()}`,
            description: `${status.eventCount} events, ${status.anomalyCount} anomalies`,
            timestamp: new Date(),
            area
          });
        }
      });
    }

    return newIndicators;
  }, [behavioralData, showBaselines, showAnomalies]);

  // Get position for area indicators (mock implementation - would be replaced with actual area mapping)
  const getAreaPosition = (area: string, index: number, isAnomaly: boolean = false): BehavioralIndicator['position'] => {
    // This would be replaced with actual area mapping logic
    // For now, distribute indicators across the frame
    const col = index % 3;
    const row = Math.floor(index / 3);
    const offset = isAnomaly ? 0.05 : 0;
    
    return {
      x: 0.1 + (col * 0.3) + offset,
      y: 0.1 + (row * 0.3) + offset,
      width: 0.2,
      height: 0.15
    };
  };

  const getBaselineSeverity = (baseline: any): BehavioralIndicator['severity'] => {
    const sampleCount = baseline.sampleCount || 0;
    if (sampleCount > 100) return 'low';
    if (sampleCount > 50) return 'medium';
    if (sampleCount > 20) return 'high';
    return 'critical';
  };

  const getSeverityLabel = (severity: string): string => {
    return severity.charAt(0).toUpperCase() + severity.slice(1);
  };

  // Update indicators when data changes
  useEffect(() => {
    const newIndicators = processBehavioralData();
    setIndicators(newIndicators);
  }, [processBehavioralData]);

  /**
   * Draw behavioral indicators on canvas
   */
  const drawBehavioralIndicators = useCallback(() => {
    if (!canvasRef.current || !containerRef.current || !isVisible) {
      return;
    }

    const canvas = canvasRef.current;
    const container = containerRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;

    // Get container dimensions
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;

    // Update canvas size to match container
    if (canvas.width !== containerWidth || canvas.height !== containerHeight) {
      canvas.width = containerWidth;
      canvas.height = containerHeight;
    }

    // Skip rendering if no indicators
    if (indicators.length === 0) return;

    // Set up drawing context
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Draw each behavioral indicator
    indicators.forEach(indicator => {
      drawBehavioralIndicator(ctx, indicator, containerWidth, containerHeight);
    });

  }, [canvasRef, containerRef, indicators, isVisible]);

  /**
   * Draw a single behavioral indicator
   */
  const drawBehavioralIndicator = useCallback((
    ctx: CanvasRenderingContext2D,
    indicator: BehavioralIndicator,
    canvasWidth: number,
    canvasHeight: number
  ) => {
    // Calculate position on canvas
    const x = indicator.position.x * canvasWidth;
    const y = indicator.position.y * canvasHeight;
    const width = indicator.position.width * canvasWidth;
    const height = indicator.position.height * canvasHeight;

    // Get colors based on type and severity
    const colors = getIndicatorColors(indicator.type, indicator.severity);
    
    // Calculate opacity based on confidence and age
    const age = Date.now() - indicator.timestamp.getTime();
    const fadeTime = indicator.type === 'anomaly' ? 30000 : 60000; // Anomalies fade faster
    const ageFactor = Math.max(0.3, 1 - (age / fadeTime));
    const opacity = Math.min(indicator.confidence, ageFactor);

    // Draw indicator background
    ctx.save();
    ctx.globalAlpha = opacity * 0.3;
    ctx.fillStyle = colors.background;
    ctx.fillRect(x, y, width, height);
    ctx.restore();

    // Draw indicator border
    ctx.save();
    ctx.globalAlpha = opacity * 0.8;
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = indicator.type === 'anomaly' ? 3 : 2;
    if (indicator.type === 'anomaly') {
      ctx.setLineDash([5, 5]); // Dashed line for anomalies
    }
    ctx.strokeRect(x, y, width, height);
    ctx.restore();

    // Draw indicator icon
    drawIndicatorIcon(ctx, indicator, x + 5, y + 5, opacity);

    // Draw label if enabled
    if (showConfidenceScores) {
      drawIndicatorLabel(ctx, indicator, x, y + height + 2, opacity);
    }

    // Draw deviation score for anomalies
    if (indicator.type === 'anomaly' && indicator.deviationScore && showConfidenceScores) {
      drawDeviationScore(ctx, indicator.deviationScore, x + width - 30, y + 5, opacity);
    }

  }, [showConfidenceScores]);

  const getIndicatorColors = (type: string, severity: string) => {
    const colorMap = {
      baseline: {
        low: { background: '#10b981', border: '#059669' },     // Green
        medium: { background: '#3b82f6', border: '#2563eb' },  // Blue
        high: { background: '#f59e0b', border: '#d97706' },    // Amber
        critical: { background: '#ef4444', border: '#dc2626' } // Red
      },
      anomaly: {
        low: { background: '#3b82f6', border: '#2563eb' },     // Blue
        medium: { background: '#f59e0b', border: '#d97706' },  // Amber
        high: { background: '#f97316', border: '#ea580c' },    // Orange
        critical: { background: '#ef4444', border: '#dc2626' } // Red
      },
      pattern: {
        low: { background: '#8b5cf6', border: '#7c3aed' },     // Purple
        medium: { background: '#06b6d4', border: '#0891b2' },  // Cyan
        high: { background: '#f59e0b', border: '#d97706' },    // Amber
        critical: { background: '#ef4444', border: '#dc2626' } // Red
      }
    };

    return colorMap[type as keyof typeof colorMap]?.[severity as keyof typeof colorMap.baseline] || 
           colorMap.baseline.low;
  };

  const drawIndicatorIcon = (
    ctx: CanvasRenderingContext2D, 
    indicator: BehavioralIndicator, 
    x: number, 
    y: number, 
    opacity: number
  ) => {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = '#ffffff';
    ctx.font = '12px sans-serif';
    
    // Draw appropriate icon based on type
    let icon = '';
    switch (indicator.type) {
      case 'baseline':
        icon = '○'; // Target/baseline icon
        break;
      case 'anomaly':
        icon = '⚠'; // Warning icon
        break;
      case 'pattern':
        icon = '◈'; // Pattern icon
        break;
    }
    
    ctx.fillText(icon, x, y);
    ctx.restore();
  };

  const drawIndicatorLabel = (
    ctx: CanvasRenderingContext2D,
    indicator: BehavioralIndicator,
    x: number,
    y: number,
    opacity: number
  ) => {
    ctx.save();
    ctx.globalAlpha = opacity * 0.9;
    
    // Draw label background
    const labelText = `${indicator.label} (${Math.round(indicator.confidence * 100)}%)`;
    ctx.font = '11px sans-serif';
    const textMetrics = ctx.measureText(labelText);
    const labelWidth = textMetrics.width + 8;
    const labelHeight = 16;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(x, y, labelWidth, labelHeight);
    
    // Draw label text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(labelText, x + 4, y + 2);
    
    ctx.restore();
  };

  const drawDeviationScore = (
    ctx: CanvasRenderingContext2D,
    score: number,
    x: number,
    y: number,
    opacity: number
  ) => {
    ctx.save();
    ctx.globalAlpha = opacity;
    
    // Draw deviation score with sigma symbol
    const scoreText = `${score.toFixed(1)}σ`;
    ctx.font = 'bold 12px sans-serif';
    const textMetrics = ctx.measureText(scoreText);
    
    // Background
    ctx.fillStyle = 'rgba(239, 68, 68, 0.9)'; // Red background
    ctx.fillRect(x - textMetrics.width - 4, y, textMetrics.width + 8, 16);
    
    // Text
    ctx.fillStyle = '#ffffff';
    ctx.fillText(scoreText, x - textMetrics.width, y + 2);
    
    ctx.restore();
  };

  // Start animation loop
  useEffect(() => {
    const animate = () => {
      drawBehavioralIndicators();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    if (isVisible) {
      animate();
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [drawBehavioralIndicators, isVisible]);

  return null; // This component only draws on the provided canvas
}

/**
 * Hook for using behavioral overlay in camera components
 */
export function useBehavioralOverlay(
  cameraId: string,
  storeId: string,
  isEnabled: boolean = true
) {
  const [overlayEnabled, setOverlayEnabled] = useState(isEnabled);
  const [showBaselines, setShowBaselines] = useState(true);
  const [showAnomalies, setShowAnomalies] = useState(true);
  const [showConfidenceScores, setShowConfidenceScores] = useState(true);

  // Query for behavioral overlay settings
  const { data: overlaySettings } = useQuery({
    queryKey: ['/api/behavioral/overlay-settings', { cameraId }],
    enabled: !!cameraId && overlayEnabled,
  });

  // Apply settings from server if available
  useEffect(() => {
    if (overlaySettings) {
      setShowBaselines(overlaySettings.showBaselines ?? true);
      setShowAnomalies(overlaySettings.showAnomalies ?? true);
      setShowConfidenceScores(overlaySettings.showConfidenceScores ?? true);
    }
  }, [overlaySettings]);

  return {
    overlayEnabled,
    setOverlayEnabled,
    showBaselines,
    setShowBaselines,
    showAnomalies,
    setShowAnomalies,
    showConfidenceScores,
    setShowConfidenceScores,
    overlaySettings
  };
}

export default BehavioralOverlay;
import { useEffect, useRef, useCallback } from "react";
import type { DetectionResult, DetectionBoundingBox, ThreatSeverity } from "@shared/schema";

// Color mapping for threat severity levels
export const THREAT_SEVERITY_COLORS: Record<ThreatSeverity, string> = {
  low: '#22c55e',      // Green
  medium: '#f59e0b',   // Orange  
  high: '#f97316',     // Orange-red
  critical: '#ef4444'  // Red
};

// Get RGB values from hex color
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 255, g: 255, b: 255 };
}

// Create RGBA color string with alpha
function createRgbaColor(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface OverlayRendererProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  containerRef: React.RefObject<HTMLElement>; // Video container for dimensions
  detections: DetectionResult[];
  getDetectionOpacity: (detection: DetectionResult) => number;
  isVisible?: boolean;
  className?: string;
}

/**
 * OverlayRenderer Component
 * 
 * Renders AI detection boxes and labels on a canvas overlay with proper scaling and fade-out effects
 */
export function OverlayRenderer({
  canvasRef,
  containerRef,
  detections,
  getDetectionOpacity,
  isVisible = true,
  className = ""
}: OverlayRendererProps) {
  
  const animationFrameRef = useRef<number>();
  const lastRenderTimeRef = useRef<number>(0);

  /**
   * Draw detection boxes and labels on canvas
   */
  const drawDetections = useCallback(() => {
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

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Skip rendering if no detections
    if (detections.length === 0) return;

    // Set up drawing context
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Draw each detection result
    detections.forEach(detection => {
      const opacity = getDetectionOpacity(detection);
      if (opacity <= 0.01) return; // Skip nearly invisible detections

      detection.boxes.forEach((box, boxIndex) => {
        drawDetectionBox(ctx, box, opacity, containerWidth, containerHeight, detection);
      });
    });

  }, [canvasRef, containerRef, detections, getDetectionOpacity, isVisible]);

  /**
   * Draw a single detection box with label
   */
  const drawDetectionBox = useCallback((
    ctx: CanvasRenderingContext2D,
    box: DetectionBoundingBox,
    opacity: number,
    canvasWidth: number,
    canvasHeight: number,
    detection: DetectionResult
  ) => {
    // Calculate box coordinates based on normalization
    let x, y, width, height;
    
    if (box.normalized) {
      // Normalized coordinates (0-1) - scale to canvas size
      x = box.x * canvasWidth;
      y = box.y * canvasHeight;
      width = box.w * canvasWidth;
      height = box.h * canvasHeight;
    } else {
      // Pixel coordinates - scale based on frame vs canvas dimensions
      const scaleX = detection.frameWidth ? canvasWidth / detection.frameWidth : 1;
      const scaleY = detection.frameHeight ? canvasHeight / detection.frameHeight : 1;
      
      x = box.x * scaleX;
      y = box.y * scaleY;
      width = box.w * scaleX;
      height = box.h * scaleY;
    }

    // Clamp coordinates to canvas bounds
    x = Math.max(0, Math.min(x, canvasWidth - 2));
    y = Math.max(0, Math.min(y, canvasHeight - 2));
    width = Math.min(width, canvasWidth - x);
    height = Math.min(height, canvasHeight - y);

    // Skip boxes that are too small or invalid
    if (width < 4 || height < 4) return;

    // Get colors based on severity
    const baseColor = box.color || THREAT_SEVERITY_COLORS[box.severity];
    const strokeColor = createRgbaColor(baseColor, opacity);
    const fillColor = createRgbaColor(baseColor, opacity * 0.15); // Light fill

    // Draw detection box
    ctx.strokeStyle = strokeColor;
    ctx.fillStyle = fillColor;
    ctx.lineWidth = Math.max(2, Math.min(4, width / 50)); // Adaptive line width

    // Draw filled rectangle (background)
    ctx.fillRect(x, y, width, height);
    
    // Draw border
    ctx.strokeRect(x, y, width, height);

    // Draw corner indicators for better visibility
    const cornerSize = Math.min(12, width / 8, height / 8);
    if (cornerSize >= 4) {
      ctx.lineWidth = Math.max(1, cornerSize / 4);
      
      // Top-left corner
      ctx.beginPath();
      ctx.moveTo(x, y + cornerSize);
      ctx.lineTo(x, y);
      ctx.lineTo(x + cornerSize, y);
      ctx.stroke();

      // Top-right corner  
      ctx.beginPath();
      ctx.moveTo(x + width - cornerSize, y);
      ctx.lineTo(x + width, y);
      ctx.lineTo(x + width, y + cornerSize);
      ctx.stroke();

      // Bottom-left corner
      ctx.beginPath();
      ctx.moveTo(x, y + height - cornerSize);
      ctx.lineTo(x, y + height);
      ctx.lineTo(x + cornerSize, y + height);
      ctx.stroke();

      // Bottom-right corner
      ctx.beginPath();
      ctx.moveTo(x + width - cornerSize, y + height);
      ctx.lineTo(x + width, y + height);
      ctx.lineTo(x + width, y + height - cornerSize);
      ctx.stroke();
    }

    // Draw label background and text
    const label = `${box.label} ${(box.confidence * 100).toFixed(0)}%`;
    const fontSize = Math.max(10, Math.min(16, width / 8));
    ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;

    // Measure text dimensions
    const textMetrics = ctx.measureText(label);
    const textWidth = textMetrics.width;
    const textHeight = fontSize;
    
    // Position label above box if possible, otherwise inside
    const labelPadding = 4;
    const labelX = x;
    let labelY = y - textHeight - labelPadding * 2;
    
    // If label would be outside canvas, place it inside the box
    if (labelY < 0) {
      labelY = y + labelPadding;
    }

    // Ensure label doesn't extend beyond canvas width
    const maxLabelWidth = Math.min(textWidth + labelPadding * 2, canvasWidth - labelX);
    
    // Draw label background
    const labelBgColor = createRgbaColor(baseColor, Math.min(0.9, opacity + 0.3));
    ctx.fillStyle = labelBgColor;
    ctx.fillRect(labelX, labelY, maxLabelWidth, textHeight + labelPadding * 2);

    // Draw label text
    ctx.fillStyle = 'white';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, labelX + labelPadding, labelY + labelPadding);

    // Draw severity indicator (small colored dot)
    const dotSize = Math.max(3, fontSize / 4);
    const dotX = labelX + maxLabelWidth - dotSize - labelPadding;
    const dotY = labelY + labelPadding + dotSize / 2;
    
    ctx.beginPath();
    ctx.arc(dotX, dotY, dotSize, 0, 2 * Math.PI);
    ctx.fillStyle = createRgbaColor(baseColor, 1.0);
    ctx.fill();

  }, []);

  /**
   * Animation loop for smooth rendering
   */
  const animate = useCallback(() => {
    const now = performance.now();
    
    // Throttle rendering to ~30 FPS for performance
    if (now - lastRenderTimeRef.current >= 33) {
      drawDetections();
      lastRenderTimeRef.current = now;
    }

    if (isVisible) {
      animationFrameRef.current = requestAnimationFrame(animate);
    }
  }, [drawDetections, isVisible]);

  // Start/stop animation loop based on visibility
  useEffect(() => {
    if (isVisible) {
      animate();
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isVisible, animate]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      // Trigger a redraw on next animation frame
      requestAnimationFrame(drawDetections);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [drawDetections]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none z-10 ${className}`}
      style={{
        display: isVisible ? 'block' : 'none'
      }}
      data-testid="detection-overlay-canvas"
      aria-hidden="true"
    />
  );
}

/**
 * Detection Stats Component (optional overlay information)
 */
export interface DetectionStatsProps {
  detections: DetectionResult[];
  className?: string;
}

export function DetectionStats({ detections, className = "" }: DetectionStatsProps) {
  if (detections.length === 0) return null;

  const totalBoxes = detections.reduce((sum, d) => sum + d.boxes.length, 0);
  const latestDetection = detections[0]; // Assuming sorted by timestamp desc
  const severityCounts = detections.reduce((counts, detection) => {
    detection.boxes.forEach(box => {
      counts[box.severity] = (counts[box.severity] || 0) + 1;
    });
    return counts;
  }, {} as Record<ThreatSeverity, number>);

  return (
    <div 
      className={`absolute top-2 right-2 bg-black/60 backdrop-blur-sm text-white text-xs rounded px-2 py-1 ${className}`}
      data-testid="detection-stats"
    >
      <div>Detections: {totalBoxes}</div>
      {Object.entries(severityCounts).map(([severity, count]) => (
        <div key={severity} className="flex items-center gap-1">
          <div 
            className="w-2 h-2 rounded-full" 
            style={{ backgroundColor: THREAT_SEVERITY_COLORS[severity as ThreatSeverity] }}
          />
          <span className="capitalize">{severity}: {count}</span>
        </div>
      ))}
    </div>
  );
}
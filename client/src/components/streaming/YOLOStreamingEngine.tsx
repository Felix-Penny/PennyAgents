import React, { useEffect, useRef, useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  Users, 
  Package,
  Activity,
  Brain,
  Target
} from "lucide-react";
import type { Camera } from "@shared/schema";

interface YOLODetection {
  id: string;
  type: string;
  class_id: number;
  confidence: number;
  bounding_box: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  absolute_bbox: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
  risk_level: 'low' | 'medium' | 'high';
  security_relevant: boolean;
  model: string;
}

interface PoseAnalysis {
  person_id: string;
  confidence: number;
  behavior_indicators: {
    concealment_gesture: boolean;
    reaching_motion: boolean;
    aggressive_posture: boolean;
    unusual_stance: boolean;
    risk_score: number;
  };
  suspicious_activity: boolean;
  model: string;
}

interface EnhancedThreatAssessment {
  threat_level: 'low' | 'medium' | 'high' | 'critical';
  risk_score: number;
  threat_types: string[];
  behavioral_alerts: string[];
  object_alerts: string[];
  recommendations: string[];
  confidence: number;
}

interface YOLOAnalysisResult {
  analysis_id: string;
  timestamp: string;
  object_detections: YOLODetection[];
  pose_analyses: PoseAnalysis[];
  threat_assessment: EnhancedThreatAssessment;
  processing_time_ms: number;
  image_dimensions: { width: number; height: number };
}

interface YOLOStreamingEngineProps {
  camera: Camera;
  width?: number;
  height?: number;
  analysisInterval?: number; // milliseconds between analyses
  enableBehaviorAnalysis?: boolean;
  enableObjectDetection?: boolean;
  confidenceThreshold?: number;
  onThreatDetected?: (threat: EnhancedThreatAssessment) => void;
  onAnalysisComplete?: (result: YOLOAnalysisResult) => void;
}

export function YOLOStreamingEngine({
  camera,
  width = 640,
  height = 480,
  analysisInterval = 2000, // 2 seconds
  enableBehaviorAnalysis = true,
  enableObjectDetection = true,
  confidenceThreshold = 0.5,
  onThreatDetected,
  onAnalysisComplete
}: YOLOStreamingEngineProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyzerRef = useRef<number | null>(null);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisEnabled, setAnalysisEnabled] = useState(true);
  const [currentAnalysis, setCurrentAnalysis] = useState<YOLOAnalysisResult | null>(null);
  const [detectionOverlays, setDetectionOverlays] = useState<YOLODetection[]>([]);
  const [poseOverlays, setPoseOverlays] = useState<PoseAnalysis[]>([]);
  
  // Statistics
  const [stats, setStats] = useState({
    totalAnalyses: 0,
    averageProcessingTime: 0,
    threatsDetected: 0,
    peopleDetected: 0,
    objectsDetected: 0
  });

  const captureFrame = useCallback(async (): Promise<Blob | null> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    if (!video || !canvas || video.videoWidth === 0) return null;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    
    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw current frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to blob
    return new Promise(resolve => {
      canvas.toBlob(resolve, 'image/jpeg', 0.8);
    });
  }, []);

  const analyzeFrame = useCallback(async () => {
    if (!analysisEnabled || isAnalyzing) return;
    
    setIsAnalyzing(true);
    
    try {
      const frameBlob = await captureFrame();
      if (!frameBlob) return;
      
      // Prepare form data
      const formData = new FormData();
      formData.append('file', frameBlob, 'frame.jpg');
      formData.append('confidence_threshold', confidenceThreshold.toString());
      formData.append('include_pose', enableBehaviorAnalysis.toString());
      
      // Send to YOLO analysis endpoint
      const response = await fetch('/api/ai/analyze/yolo', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }
      
      const result: YOLOAnalysisResult = await response.json();
      
      // Update state
      setCurrentAnalysis(result);
      setDetectionOverlays(result.object_detections || []);
      setPoseOverlays(result.pose_analyses || []);
      
      // Update statistics
      setStats(prev => ({
        totalAnalyses: prev.totalAnalyses + 1,
        averageProcessingTime: Math.round(
          (prev.averageProcessingTime * prev.totalAnalyses + result.processing_time_ms) /
          (prev.totalAnalyses + 1)
        ),
        threatsDetected: prev.threatsDetected + (result.threat_assessment.threat_level !== 'low' ? 1 : 0),
        peopleDetected: prev.peopleDetected + (result.object_detections?.filter(d => d.type === 'person').length || 0),
        objectsDetected: prev.objectsDetected + (result.object_detections?.length || 0)
      }));
      
      // Trigger callbacks
      if (onAnalysisComplete) {
        onAnalysisComplete(result);
      }
      
      if (onThreatDetected && result.threat_assessment.threat_level !== 'low') {
        onThreatDetected(result.threat_assessment);
      }
      
    } catch (error) {
      console.error('Frame analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [analysisEnabled, isAnalyzing, captureFrame, confidenceThreshold, enableBehaviorAnalysis, onAnalysisComplete, onThreatDetected]);

  // Set up analysis interval
  useEffect(() => {
    if (analysisEnabled && enableObjectDetection) {
      analyzerRef.current = window.setInterval(analyzeFrame, analysisInterval);
      
      return () => {
        if (analyzerRef.current) {
          clearInterval(analyzerRef.current);
          analyzerRef.current = null;
        }
      };
    }
  }, [analysisEnabled, enableObjectDetection, analyzeFrame, analysisInterval]);

  const renderBoundingBoxes = () => {
    if (!currentAnalysis) return null;
    
    const videoElement = videoRef.current;
    if (!videoElement) return null;
    
    const videoRect = videoElement.getBoundingClientRect();
    
    return (
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          width: videoRect.width,
          height: videoRect.height
        }}
      >
        {detectionOverlays.map((detection) => {
          const bbox = detection.bounding_box;
          const color = detection.risk_level === 'high' ? 'border-red-500' : 
                       detection.risk_level === 'medium' ? 'border-yellow-500' : 'border-green-500';
          
          return (
            <div
              key={detection.id}
              className={`absolute border-2 ${color} bg-black bg-opacity-20`}
              style={{
                left: `${bbox.x * 100}%`,
                top: `${bbox.y * 100}%`,
                width: `${bbox.width * 100}%`,
                height: `${bbox.height * 100}%`,
              }}
            >
              <div className={`absolute -top-6 left-0 px-1 py-0.5 text-xs font-medium text-white ${
                detection.risk_level === 'high' ? 'bg-red-500' :
                detection.risk_level === 'medium' ? 'bg-yellow-500' : 'bg-green-500'
              } rounded`}>
                {detection.type} ({Math.round(detection.confidence * 100)}%)
              </div>
            </div>
          );
        })}
        
        {/* Pose keypoints visualization */}
        {poseOverlays.map((pose, index) => (
          <div key={`pose-${index}`} className="absolute">
            {pose.suspicious_activity && (
              <div className="absolute top-2 right-2 px-2 py-1 bg-red-600 text-white text-xs rounded">
                Suspicious Behavior
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  const getThreatColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-600';
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-yellow-500';
      default: return 'bg-green-500';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5" />
            YOLO Enhanced Analysis - {camera.name}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant={analysisEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setAnalysisEnabled(!analysisEnabled)}
            >
              {analysisEnabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Video Stream with Overlays */}
        <div className="relative">
          <video
            ref={videoRef}
            width={width}
            height={height}
            autoPlay
            muted
            className="w-full rounded-lg bg-black"
            style={{ aspectRatio: `${width}/${height}` }}
          />
          <canvas
            ref={canvasRef}
            className="hidden"
          />
          {renderBoundingBoxes()}
          
          {isAnalyzing && (
            <div className="absolute top-2 left-2 flex items-center gap-2 px-2 py-1 bg-blue-600 text-white text-xs rounded">
              <Target className="h-3 w-3 animate-spin" />
              Analyzing...
            </div>
          )}
        </div>

        {/* Current Analysis Status */}
        {currentAnalysis && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-sm">People: {currentAnalysis.pose_analyses?.length || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-green-500" />
              <span className="text-sm">Objects: {currentAnalysis.object_detections?.length || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-purple-500" />
              <span className="text-sm">Process: {currentAnalysis.processing_time_ms}ms</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={getThreatColor(currentAnalysis.threat_assessment.threat_level)}>
                {currentAnalysis.threat_assessment.threat_level.toUpperCase()}
              </Badge>
            </div>
          </div>
        )}

        {/* Threat Assessment Details */}
        {currentAnalysis?.threat_assessment && currentAnalysis.threat_assessment.threat_level !== 'low' && (
          <div className="p-3 border-l-4 border-orange-500 bg-orange-50 dark:bg-orange-950/20">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <span className="font-medium text-orange-800 dark:text-orange-200">
                Security Alert
              </span>
            </div>
            
            {currentAnalysis.threat_assessment.behavioral_alerts.length > 0 && (
              <div className="mb-2">
                <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Behavioral Alerts:</p>
                <ul className="text-sm text-orange-600 dark:text-orange-400 list-disc list-inside">
                  {currentAnalysis.threat_assessment.behavioral_alerts.map((alert, index) => (
                    <li key={index}>{alert}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {currentAnalysis.threat_assessment.object_alerts.length > 0 && (
              <div className="mb-2">
                <p className="text-sm font-medium text-orange-700 dark:text-orange-300">Object Alerts:</p>
                <ul className="text-sm text-orange-600 dark:text-orange-400 list-disc list-inside">
                  {currentAnalysis.threat_assessment.object_alerts.map((alert, index) => (
                    <li key={index}>{alert}</li>
                  ))}
                </ul>
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-orange-700 dark:text-orange-300">Risk Score:</span>
              <Progress 
                value={(currentAnalysis.threat_assessment.risk_score / 10) * 100} 
                className="flex-1 h-2"
              />
              <span className="text-sm font-medium text-orange-800 dark:text-orange-200">
                {currentAnalysis.threat_assessment.risk_score.toFixed(1)}/10
              </span>
            </div>
          </div>
        )}

        {/* Analysis Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
            <div className="text-lg font-bold text-blue-600">{stats.totalAnalyses}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Total Analyses</div>
          </div>
          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
            <div className="text-lg font-bold text-green-600">{stats.averageProcessingTime}ms</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Avg Processing</div>
          </div>
          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
            <div className="text-lg font-bold text-red-600">{stats.threatsDetected}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">Threats Detected</div>
          </div>
          <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
            <div className="text-lg font-bold text-purple-600">{stats.peopleDetected}</div>
            <div className="text-xs text-gray-600 dark:text-gray-400">People Tracked</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Upload, 
  Video, 
  Users, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Play,
  Eye,
  Download,
  Shield,
  Brain,
  Target,
  Zap,
  BarChart3,
  FileText,
  Camera
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

interface AIAnalysisResult {
  analysisId: string;
  status: 'completed' | 'processing' | 'failed';
  totalDetections: number;
  threatDetections: number;
  suspiciousActivities: number;
  
  // Quality and processing metrics
  averageConfidence: number;
  qualityScore: number;
  processingDuration: number;
  
  // Threat breakdown
  threats: {
    high: number;
    medium: number;
    low: number;
    critical: number;
  };
  
  // Frame analysis results
  frames: Array<{
    frameNumber: number;
    timestamp: number;
    detectionCount: number;
    highThreatDetections: number;
    qualityScore: number;
  }>;
  
  // Most significant detections
  significantDetections: Array<{
    id: string;
    type: string;
    threatType?: string;
    behaviorType?: string;
    confidence: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    timestamp: number;
    boundingBox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  }>;
  
  storeId: string;
  cameraId: string;
  createdAt: string;
  completedAt?: string;
}

interface FrameAnalysisResult {
  analysisId: string;
  frameAnalysis: {
    detections: Array<{
      id: string;
      detectionType: string;
      threatType?: string;
      behaviorType?: string;
      confidence: number;
      severity: string;
      description: string;
      boundingBox?: any;
    }>;
    qualityScore: number;
    lightingConditions: string;
    motionLevel: string;
    crowdDensity: string;
    processingTime: number;
  };
  threatAssessment: {
    detectedThreats: Array<{
      id: string;
      category: string;
      severity: string;
      confidence: number;
      description: string;
      reasoning: string;
      immediateResponse: boolean;
      lawEnforcementRequired: boolean;
    }>;
    overallRiskLevel: string;
    recommendedActions: string[];
    analysisMetrics: {
      totalThreats: number;
      highSeverityThreats: number;
      averageConfidence: number;
      processingTime: number;
    };
  };
  timestamp: string;
  storeId: string;
  cameraId: string;
}

export default function VideoUploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [frameAnalysisResult, setFrameAnalysisResult] = useState<FrameAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisType, setAnalysisType] = useState<'video' | 'frame'>('video');
  const [selectedFrame, setSelectedFrame] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('video/')) {
        setError('Please select a valid video file');
        return;
      }
      
      // Validate file size (max 100MB for MVP)
      if (file.size > 100 * 1024 * 1024) {
        setError('File size must be less than 100MB');
        return;
      }

      setSelectedFile(file);
      setError(null);
      setAnalysisResult(null);
    }
  };


  const analyzeVideo = async () => {
    if (!selectedFile) {
      setError('Please select a video file to analyze');
      return;
    }
    
    // For super admins without store assignment, use default store
    const storeId = user?.storeId || 'store-001';
    if (!storeId) {
      setError('Store configuration required. Please contact support.');
      return;
    }

    setAnalyzing(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Step 1: Get signed URL for video upload
      setUploadProgress(10);
      const signedUrlResponse = await apiRequest('/api/ai/video-upload-url', {
        method: 'POST',
        body: JSON.stringify({
          storeId: storeId,
          cameraId: 'video-upload'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!signedUrlResponse.ok) {
        const errorData = await signedUrlResponse.json();
        throw new Error(errorData.message || 'Failed to get upload URL');
      }

      const { uploadUrl, maxFileSize, allowedTypes } = await signedUrlResponse.json();
      
      // Validate file size against server limits
      if (selectedFile.size > maxFileSize) {
        throw new Error(`File size exceeds limit of ${Math.round(maxFileSize / 1024 / 1024)}MB`);
      }

      // Validate file type against server requirements
      if (allowedTypes && !allowedTypes.includes(selectedFile.type)) {
        throw new Error(`File type not allowed. Supported types: ${allowedTypes.join(', ')}`);
      }

      // Step 2: Upload video directly to Object Storage via signed URL
      setUploadProgress(30);
      const uploadResponse = await fetch(uploadUrl, {
        method: 'PUT',
        body: selectedFile,
        headers: {
          'Content-Type': selectedFile.type,
        }
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.statusText}`);
      }

      setUploadProgress(60);

      // Step 3: Extract object path from upload URL for analysis
      const uploadUrlObj = new URL(uploadUrl);
      const objectPath = uploadUrlObj.pathname; // This gives us the object path in Object Storage

      // Step 4: Send analysis request with object path (not video data)
      const analysisResponse = await apiRequest('/api/ai/analyze-video', {
        method: 'POST',
        body: JSON.stringify({
          objectPath: objectPath,
          storeId: storeId,
          cameraId: 'video-upload',
          config: {
            enableThreatDetection: true,
            enableBehaviorAnalysis: true,
            enableObjectDetection: true,
            confidenceThreshold: 0.7
          }
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      setUploadProgress(100);
      
      if (!analysisResponse.ok) {
        const errorData = await analysisResponse.json();
        throw new Error(errorData.message || 'AI analysis failed');
      }

      const result: AIAnalysisResult = await analysisResponse.json();
      setAnalysisResult(result);
      setAnalysisType('video');
      
      toast({
        title: "AI Analysis Complete",
        description: `Found ${result.totalDetections} detections, ${result.threatDetections} threats`,
      });

      // Show threat alerts for high-severity detections
      if (result.threats.critical > 0 || result.threats.high > 0) {
        toast({
          title: "Security Threats Detected!", 
          description: `${result.threats.critical + result.threats.high} high-severity threats detected`,
          variant: "destructive"
        });
      }

    } catch (error: any) {
      console.error('AI video analysis error:', error);
      setError(error.message || 'Video analysis failed');
      toast({
        title: "Video Analysis Failed",
        description: error.message || "Failed to upload or analyze video",
        variant: "destructive"
      });
    } finally {
      setAnalyzing(false);
      setUploadProgress(0);
    }
  };

  const analyzeFrame = async () => {
    if (!selectedFrame) {
      setError('Please select an image to analyze');
      return;
    }
    
    // For super admins without store assignment, use default store
    const storeId = user?.storeId || 'store-001';
    if (!storeId) {
      setError('Store configuration required. Please contact support.');
      return;
    }

    setAnalyzing(true);
    setError(null);

    try {
      // Send to frame analysis API
      const response = await apiRequest('/api/ai/analyze-frame', {
        method: 'POST',
        body: JSON.stringify({
          imageData: selectedFrame,
          storeId: storeId,
          cameraId: 'frame-upload',
          config: {
            enableThreatDetection: true,
            enableBehaviorAnalysis: true,
            confidenceThreshold: 0.7
          }
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Frame analysis failed');
      }

      const result: FrameAnalysisResult = await response.json();
      setFrameAnalysisResult(result);
      setAnalysisType('frame');
      
      toast({
        title: "Frame Analysis Complete",
        description: `Found ${result.frameAnalysis.detections.length} detections, risk level: ${result.threatAssessment.overallRiskLevel}`,
      });

      // Show threat alerts for high-severity detections
      if (result.threatAssessment.analysisMetrics.highSeverityThreats > 0) {
        toast({
          title: "Threats Detected in Frame!", 
          description: `${result.threatAssessment.analysisMetrics.highSeverityThreats} high-severity threats detected`,
          variant: "destructive"
        });
      }

    } catch (error: any) {
      console.error('AI frame analysis error:', error);
      setError(error.message || 'Frame analysis failed');
      toast({
        title: "Frame Analysis Failed",
        description: error.message || "An error occurred during frame analysis",
        variant: "destructive"
      });
    } finally {
      setAnalyzing(false);
    }
  };

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError('Please select a valid image file');
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('Image size must be less than 10MB');
        return;
      }

      // Convert to base64
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const base64Data = base64.split(',')[1];
        setSelectedFrame(base64Data);
        setError(null);
        setFrameAnalysisResult(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const createClip = async (startTime: number, endTime: number) => {
    if (!analysisResult) return;

    try {
      const response = await apiRequest('/api/video/create-clip', {
        method: 'POST',
        body: JSON.stringify({
          analysisId: analysisResult.analysisId,
          startTime,
          endTime,
          reason: 'offender_detection'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const clipData = await response.json();
        toast({
          title: "Clip Created",
          description: `Video clip saved: ${clipData.clipId}`,
        });
      }
    } catch (error) {
      console.error('Clip creation failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
            <Brain className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">AI Video Analytics</h1>
            <p className="text-muted-foreground">Advanced AI-powered threat detection and behavior analysis</p>
          </div>
        </div>

        {/* Analysis Tabs */}
        <Tabs defaultValue="video" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="video" data-testid="tab-video-analysis">
              <Video className="w-4 h-4 mr-2" />
              Video Analysis
            </TabsTrigger>
            <TabsTrigger value="frame" data-testid="tab-frame-analysis">
              <Camera className="w-4 h-4 mr-2" />
              Frame Analysis
            </TabsTrigger>
          </TabsList>

          {/* Video Analysis Tab */}
          <TabsContent value="video" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Upload Video for AI Analysis
                </CardTitle>
                <CardDescription>
                  Upload security footage for comprehensive threat detection and behavioral analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="video/*"
                className="hidden"
                data-testid="input-video-file"
              />
              
              {selectedFile ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-2">
                    <Video className="w-8 h-8 text-green-600" />
                    <span className="font-medium">{selectedFile.name}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button 
                      onClick={() => fileInputRef.current?.click()}
                      variant="outline"
                      data-testid="button-change-video"
                    >
                      Change Video
                    </Button>
                    <Button 
                      onClick={analyzeVideo}
                      disabled={analyzing}
                      data-testid="button-analyze-video"
                    >
                      {analyzing ? (
                        <>
                          <Clock className="w-4 h-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4 mr-2" />
                          Analyze Video
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <Video className="w-12 h-12 mx-auto text-gray-400" />
                  <div>
                    <p className="text-lg font-medium">Drop video file here</p>
                    <p className="text-sm text-muted-foreground">or click to browse</p>
                  </div>
                  <Button onClick={() => fileInputRef.current?.click()} data-testid="button-upload-video">
                    <Upload className="w-4 h-4 mr-2" />
                    Select Video
                  </Button>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            {analyzing && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Analyzing video...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} />
              </div>
            )}

            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Analysis Results */}
        {analysisResult && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Analysis Results
              </CardTitle>
              <CardDescription>
                Facial recognition and activity analysis complete
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* AI Analysis Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <Target className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                  <div className="text-2xl font-bold">{analysisResult.totalDetections}</div>
                  <div className="text-sm text-muted-foreground">Total Detections</div>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                  <Shield className="w-8 h-8 mx-auto mb-2 text-red-600" />
                  <div className="text-2xl font-bold">{analysisResult.threatDetections}</div>
                  <div className="text-sm text-muted-foreground">Threat Detections</div>
                </div>
                <div className="text-center p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-orange-600" />
                  <div className="text-2xl font-bold">{analysisResult.threats.critical + analysisResult.threats.high}</div>
                  <div className="text-sm text-muted-foreground">High Priority Threats</div>
                </div>
                <div className="text-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <BarChart3 className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                  <div className="text-2xl font-bold">{Math.round(analysisResult.averageConfidence * 100)}%</div>
                  <div className="text-sm text-muted-foreground">Avg Confidence</div>
                </div>
              </div>

              {/* Threat Breakdown */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Threat Level Breakdown</h3>
                <div className="grid grid-cols-4 gap-4">
                  <div className="text-center p-3 border rounded-lg">
                    <div className="text-xl font-bold text-red-600">{analysisResult.threats.critical}</div>
                    <div className="text-xs text-muted-foreground">Critical</div>
                  </div>
                  <div className="text-center p-3 border rounded-lg">
                    <div className="text-xl font-bold text-orange-600">{analysisResult.threats.high}</div>
                    <div className="text-xs text-muted-foreground">High</div>
                  </div>
                  <div className="text-center p-3 border rounded-lg">
                    <div className="text-xl font-bold text-yellow-600">{analysisResult.threats.medium}</div>
                    <div className="text-xs text-muted-foreground">Medium</div>
                  </div>
                  <div className="text-center p-3 border rounded-lg">
                    <div className="text-xl font-bold text-green-600">{analysisResult.threats.low}</div>
                    <div className="text-xs text-muted-foreground">Low</div>
                  </div>
                </div>
              </div>

              {/* Detected Faces */}
              {analysisResult.analysisResult.detectedFaces.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Detected Faces</h3>
                  <div className="space-y-2">
                    {analysisResult.analysisResult.detectedFaces.map((face, index) => (
                      <div key={face.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                            <Users className="w-4 h-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">Face {index + 1}</p>
                            <p className="text-sm text-muted-foreground">
                              Confidence: {(face.confidence * 100).toFixed(1)}%
                              {face.features?.age && ` • ${face.features.age}`}
                              {face.features?.gender && ` • ${face.features.gender}`}
                            </p>
                          </div>
                        </div>
                        <Badge variant={face.confidence > 0.8 ? "default" : "secondary"}>
                          {face.confidence > 0.8 ? "High" : "Medium"} Confidence
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Matched Offenders */}
              {analysisResult.analysisResult.matchedOffenders.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Offender Matches</h3>
                  <div className="space-y-2">
                    {analysisResult.analysisResult.matchedOffenders.map((match, index) => (
                      <div key={`${match.offenderId}-${index}`} className="flex items-center justify-between p-3 border rounded-lg bg-red-50 dark:bg-red-950">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center">
                            <AlertTriangle className="w-4 h-4 text-red-600" />
                          </div>
                          <div>
                            <p className="font-medium">Known Offender Match</p>
                            <p className="text-sm text-muted-foreground">
                              Confidence: {(match.confidence * 100).toFixed(1)}%
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant="destructive">
                            {match.confidence > 0.8 ? "High Risk" : "Medium Risk"}
                          </Badge>
                          <Button 
                            size="sm" 
                            onClick={() => createClip(0, 30)}
                            data-testid={`button-create-clip-${index}`}
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Create Clip
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Suspicious Activities */}
              {analysisResult.analysisResult.suspiciousActivity.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3">Suspicious Activities</h3>
                  <div className="space-y-2">
                    {analysisResult.analysisResult.suspiciousActivity.map((activity, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
                            <Eye className="w-4 h-4 text-orange-600" />
                          </div>
                          <div>
                            <p className="font-medium capitalize">{activity.type.replace('_', ' ')}</p>
                            <p className="text-sm text-muted-foreground">{activity.description}</p>
                          </div>
                        </div>
                        <Badge variant={activity.confidence > 0.7 ? "default" : "secondary"}>
                          {(activity.confidence * 100).toFixed(1)}% Confidence
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
          </TabsContent>

          {/* Frame Analysis Tab */}
          <TabsContent value="frame" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="w-5 h-5" />
                  Upload Image for Frame Analysis
                </CardTitle>
                <CardDescription>
                  Upload a security camera frame or image for AI threat detection analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                  <input
                    type="file"
                    ref={imageInputRef}
                    onChange={handleImageSelect}
                    accept="image/*"
                    className="hidden"
                    data-testid="input-image-file"
                  />
                  
                  {selectedFrame ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-center gap-2">
                        <Camera className="w-8 h-8 text-green-600" />
                        <span className="font-medium">Image selected</span>
                      </div>
                      <div className="flex gap-2 justify-center">
                        <Button 
                          onClick={() => imageInputRef.current?.click()}
                          variant="outline"
                          data-testid="button-change-image"
                        >
                          Change Image
                        </Button>
                        <Button 
                          onClick={analyzeFrame}
                          disabled={analyzing}
                          data-testid="button-analyze-frame"
                        >
                          {analyzing ? (
                            <>
                              <Clock className="w-4 h-4 mr-2 animate-spin" />
                              Analyzing...
                            </>
                          ) : (
                            <>
                              <Eye className="w-4 h-4 mr-2" />
                              Analyze Frame
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Camera className="w-12 h-12 mx-auto text-gray-400" />
                      <div>
                        <p className="text-lg font-medium">Drop image file here</p>
                        <p className="text-sm text-muted-foreground">or click to browse</p>
                      </div>
                      <Button onClick={() => imageInputRef.current?.click()} data-testid="button-upload-image">
                        <Upload className="w-4 h-4 mr-2" />
                        Select Image
                      </Button>
                    </div>
                  )}
                </div>

                {/* Error Display */}
                {error && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Frame Analysis Results */}
            {frameAnalysisResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    Frame Analysis Results
                  </CardTitle>
                  <CardDescription>
                    AI-powered frame threat detection and behavior analysis complete
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Frame Analysis Summary Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                      <Target className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                      <div className="text-2xl font-bold">{frameAnalysisResult.frameAnalysis.detections.length}</div>
                      <div className="text-sm text-muted-foreground">Total Detections</div>
                    </div>
                    <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                      <Shield className="w-8 h-8 mx-auto mb-2 text-red-600" />
                      <div className="text-2xl font-bold">{frameAnalysisResult.threatAssessment.analysisMetrics.totalThreats}</div>
                      <div className="text-sm text-muted-foreground">Threat Detections</div>
                    </div>
                    <div className="text-center p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
                      <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-orange-600" />
                      <div className="text-2xl font-bold">{frameAnalysisResult.threatAssessment.analysisMetrics.highSeverityThreats}</div>
                      <div className="text-sm text-muted-foreground">High Priority Threats</div>
                    </div>
                    <div className="text-center p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                      <BarChart3 className="w-8 h-8 mx-auto mb-2 text-purple-600" />
                      <div className="text-2xl font-bold">{Math.round(frameAnalysisResult.threatAssessment.analysisMetrics.averageConfidence * 100)}%</div>
                      <div className="text-sm text-muted-foreground">Avg Confidence</div>
                    </div>
                  </div>

                  {/* Overall Risk Level */}
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Shield className="w-6 h-6" />
                      <div>
                        <p className="font-semibold">Overall Risk Level</p>
                        <Badge 
                          variant={
                            frameAnalysisResult.threatAssessment.overallRiskLevel === 'HIGH' ? 'destructive' :
                            frameAnalysisResult.threatAssessment.overallRiskLevel === 'MEDIUM' ? 'default' : 
                            'secondary'
                          }
                        >
                          {frameAnalysisResult.threatAssessment.overallRiskLevel}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Detected Threats */}
                  {frameAnalysisResult.threatAssessment.detectedThreats.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Detected Threats</h3>
                      <div className="space-y-2">
                        {frameAnalysisResult.threatAssessment.detectedThreats.map((threat, index) => (
                          <div key={threat.id} className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-red-600" />
                                <p className="font-medium">{threat.category}</p>
                              </div>
                              <Badge variant={threat.severity === 'high' ? 'destructive' : 'default'}>
                                {threat.severity.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mb-1">{threat.description}</p>
                            <p className="text-xs text-muted-foreground">
                              Confidence: {(threat.confidence * 100).toFixed(1)}%
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Frame Detections */}
                  {frameAnalysisResult.frameAnalysis.detections.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Frame Detections</h3>
                      <div className="space-y-2">
                        {frameAnalysisResult.frameAnalysis.detections.map((detection, index) => (
                          <div key={detection.id} className="flex items-center justify-between p-3 border rounded-lg">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                                <Eye className="w-4 h-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium">{detection.detectionType}</p>
                                <p className="text-sm text-muted-foreground">{detection.description}</p>
                              </div>
                            </div>
                            <Badge variant={detection.confidence > 0.8 ? "default" : "secondary"}>
                              {(detection.confidence * 100).toFixed(1)}% Confidence
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommended Actions */}
                  {frameAnalysisResult.threatAssessment.recommendedActions.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Recommended Actions</h3>
                      <div className="space-y-2">
                        {frameAnalysisResult.threatAssessment.recommendedActions.map((action, index) => (
                          <div key={index} className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                            <CheckCircle className="w-5 h-5 text-blue-600" />
                            <p className="text-sm">{action}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
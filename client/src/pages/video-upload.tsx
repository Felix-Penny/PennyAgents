import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { 
  Upload, 
  Video, 
  Users, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Play,
  Eye,
  Download
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";

interface AnalysisResult {
  analysisId: string;
  detectedFaces: number;
  matchedOffenders: number;
  suspiciousActivities: number;
  highConfidenceMatches: number;
  analysisResult: {
    detectedFaces: Array<{
      id: string;
      confidence: number;
      features: any;
    }>;
    matchedOffenders: Array<{
      offenderId: string;
      confidence: number;
      faceId: string;
    }>;
    suspiciousActivity: Array<{
      type: string;
      confidence: number;
      description: string;
    }>;
  };
}

export default function VideoUploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        // Remove data:video/mp4;base64, prefix
        const base64Data = base64.split(',')[1];
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const analyzeVideo = async () => {
    if (!selectedFile || !user?.storeId) {
      setError('No video selected or missing store information');
      return;
    }

    setAnalyzing(true);
    setUploadProgress(0);
    setError(null);

    try {
      // Convert video to base64
      setUploadProgress(20);
      const videoBase64 = await convertFileToBase64(selectedFile);
      
      setUploadProgress(40);
      
      // Send to analysis API
      const response = await apiRequest('/api/video/analyze', {
        method: 'POST',
        body: JSON.stringify({
          videoBase64,
          storeId: user.storeId,
          cameraId: 'video-upload'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      setUploadProgress(100);
      
      if (!response.ok) {
        throw new Error('Analysis failed');
      }

      const result = await response.json();
      setAnalysisResult(result);
      
      toast({
        title: "Analysis Complete",
        description: `Found ${result.detectedFaces} faces, ${result.matchedOffenders} matches`,
      });

      // Create clips for high-confidence matches
      if (result.highConfidenceMatches > 0) {
        toast({
          title: "Offenders Detected!", 
          description: `${result.highConfidenceMatches} known offenders detected with high confidence`,
          variant: "destructive"
        });
      }

    } catch (error: any) {
      console.error('Analysis error:', error);
      setError(error.message || 'Analysis failed');
      toast({
        title: "Analysis Failed",
        description: error.message || "Please try again",
        variant: "destructive"
      });
    } finally {
      setAnalyzing(false);
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
            <Video className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold" data-testid="text-page-title">Video Analysis</h1>
            <p className="text-muted-foreground">Upload security footage for facial recognition analysis</p>
          </div>
        </div>

        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />
              Upload Video
            </CardTitle>
            <CardDescription>
              Select a video file to analyze for faces and suspicious activity
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
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <Users className="w-8 h-8 mx-auto mb-2 text-blue-600" />
                  <div className="text-2xl font-bold">{analysisResult.detectedFaces}</div>
                  <div className="text-sm text-muted-foreground">Faces Detected</div>
                </div>
                <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-red-600" />
                  <div className="text-2xl font-bold">{analysisResult.matchedOffenders}</div>
                  <div className="text-sm text-muted-foreground">Known Offenders</div>
                </div>
                <div className="text-center p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
                  <Eye className="w-8 h-8 mx-auto mb-2 text-orange-600" />
                  <div className="text-2xl font-bold">{analysisResult.suspiciousActivities}</div>
                  <div className="text-sm text-muted-foreground">Suspicious Activities</div>
                </div>
                <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-600" />
                  <div className="text-2xl font-bold">{analysisResult.highConfidenceMatches}</div>
                  <div className="text-sm text-muted-foreground">High Confidence</div>
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
      </div>
    </div>
  );
}
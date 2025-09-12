import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Video, Play, Pause, RotateCcw, Settings, AlertTriangle } from "lucide-react";

export default function VideoTest() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Video Test Console</h1>
          <p className="text-muted-foreground">Test video feeds, detection algorithms, and system performance</p>
        </div>
        <Badge variant="outline" className="text-blue-600">
          <Video className="w-4 h-4 mr-1" />
          Test Environment
        </Badge>
      </div>

      {/* Warning */}
      <Alert className="border-yellow-200 bg-yellow-50">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertDescription className="text-yellow-700">
          <strong>Testing Environment</strong> - This page is for system testing and calibration only. 
          Changes here may affect detection accuracy.
        </AlertDescription>
      </Alert>

      {/* Test Categories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Camera Feed Test */}
        <Card data-testid="card-camera-test">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Camera Feed Test
            </CardTitle>
            <CardDescription>
              Test individual camera feeds and connectivity
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Test Video Feed */}
            <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                <div className="text-center text-white">
                  <Video className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm opacity-75">Test Feed - Camera 001</p>
                  <div className="mt-2 w-16 h-1 bg-blue-500 mx-auto animate-pulse rounded" />
                </div>
              </div>
              
              {/* Video Controls */}
              <div className="absolute bottom-2 left-2 right-2 flex justify-between items-center">
                <div className="flex gap-1">
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="h-8 w-8 p-0"
                    data-testid="button-test-play"
                  >
                    <Play className="h-3 w-3" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="h-8 w-8 p-0"
                    data-testid="button-test-pause"
                  >
                    <Pause className="h-3 w-3" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="secondary" 
                    className="h-8 w-8 p-0"
                    data-testid="button-test-restart"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                </div>
                <Badge variant="secondary">TESTING</Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Resolution:</span>
                <p className="font-medium">1920x1080</p>
              </div>
              <div>
                <span className="text-muted-foreground">Frame Rate:</span>
                <p className="font-medium">30 FPS</p>
              </div>
              <div>
                <span className="text-muted-foreground">Latency:</span>
                <p className="font-medium">120ms</p>
              </div>
              <div>
                <span className="text-muted-foreground">Signal Quality:</span>
                <p className="font-medium text-green-600">Excellent</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" data-testid="button-test-camera-connectivity">
                Test Connectivity
              </Button>
              <Button size="sm" variant="outline" data-testid="button-calibrate-camera">
                Calibrate Camera
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Detection Algorithm Test */}
        <Card data-testid="card-detection-test">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Detection Algorithm Test
            </CardTitle>
            <CardDescription>
              Test and calibrate AI detection algorithms
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span>Face Recognition</span>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800">Active</Badge>
                  <Button size="sm" variant="outline" data-testid="button-test-face-recognition">Test</Button>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span>Behavior Analysis</span>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800">Active</Badge>
                  <Button size="sm" variant="outline" data-testid="button-test-behavior-analysis">Test</Button>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span>Object Detection</span>
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-100 text-green-800">Active</Badge>
                  <Button size="sm" variant="outline" data-testid="button-test-object-detection">Test</Button>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <span>Motion Tracking</span>
                <div className="flex items-center gap-2">
                  <Badge className="bg-yellow-100 text-yellow-800">Calibrating</Badge>
                  <Button size="sm" variant="outline" data-testid="button-test-motion-tracking">Test</Button>
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-3 bg-gray-50 dark:bg-gray-800">
              <h4 className="font-medium mb-2">Test Results</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Accuracy Rate:</span>
                  <span className="font-medium">94.2%</span>
                </div>
                <div className="flex justify-between">
                  <span>Processing Speed:</span>
                  <span className="font-medium">1.3s avg</span>
                </div>
                <div className="flex justify-between">
                  <span>False Positives:</span>
                  <span className="font-medium">5.8%</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" data-testid="button-run-full-test">
                Run Full Test Suite
              </Button>
              <Button size="sm" variant="outline" data-testid="button-export-test-results">
                Export Results
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Performance */}
      <Card data-testid="card-system-performance">
        <CardHeader>
          <CardTitle>System Performance Monitoring</CardTitle>
          <CardDescription>
            Real-time system metrics during testing
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-2xl font-bold">98.5%</div>
              <p className="text-sm text-muted-foreground">CPU Usage</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">67%</div>
              <p className="text-sm text-muted-foreground">Memory Usage</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">12ms</div>
              <p className="text-sm text-muted-foreground">Network Latency</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">45°C</div>
              <p className="text-sm text-muted-foreground">System Temperature</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Actions */}
      <Card data-testid="card-test-actions">
        <CardHeader>
          <CardTitle>Test Actions</CardTitle>
          <CardDescription>
            Administrative testing and maintenance functions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button className="h-auto py-4 flex flex-col gap-2" data-testid="button-system-diagnostics">
              <Settings className="h-6 w-6" />
              <span>System Diagnostics</span>
              <span className="text-xs text-muted-foreground">Run comprehensive system check</span>
            </Button>
            
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" data-testid="button-performance-benchmark">
              <Video className="h-6 w-6" />
              <span>Performance Benchmark</span>
              <span className="text-xs text-muted-foreground">Test system under load</span>
            </Button>
            
            <Button variant="outline" className="h-auto py-4 flex flex-col gap-2" data-testid="button-reset-calibration">
              <RotateCcw className="h-6 w-6" />
              <span>Reset Calibration</span>
              <span className="text-xs text-muted-foreground">Return to default settings</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
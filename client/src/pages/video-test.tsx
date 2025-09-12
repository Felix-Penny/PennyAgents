import { Layout } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { CameraFeed } from "@/components/security/camera-feed";
import { VideoPlayer } from "@/components/media/video-player";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Upload, Video, Play, TestTube2 } from "lucide-react";
import { useState } from "react";
import type { Camera } from "@shared/schema";

// Sample test video URLs (you can replace with your own)
const SAMPLE_VIDEOS = [
  {
    name: "Sample Security Feed 1",
    url: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4",
    description: "720p Test Video"
  },
  {
    name: "Sample Security Feed 2", 
    url: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
    description: "Big Buck Bunny Sample"
  }
];

export default function VideoTest() {
  const [customVideoUrl, setCustomVideoUrl] = useState('');
  const [selectedVideo, setSelectedVideo] = useState(SAMPLE_VIDEOS[0].url);
  const [showInCameraFeed, setShowInCameraFeed] = useState(false);

  // Mock camera data for testing
  const testCamera: Camera = {
    id: "test-cam-1",
    name: "Test Camera 1", 
    location: "Front Entrance",
    ipAddress: "192.168.1.100",
    status: "online",
    storeId: "store-1",
    capabilities: ["night_vision", "motion_detection"],
    isActive: true,
    lastSeen: new Date(),
    createdAt: new Date()
  };

  const handleCustomVideo = () => {
    if (customVideoUrl.trim()) {
      setSelectedVideo(customVideoUrl.trim());
      setShowInCameraFeed(true);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('video/')) {
      const videoUrl = URL.createObjectURL(file);
      setSelectedVideo(videoUrl);
      setShowInCameraFeed(true);
    }
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          title="Video Testing Lab"
          subtitle="Test your video feeds and streaming capabilities"
          alertCount={0}
          networkStatus="active"
        />

        <div className="flex-1 overflow-auto p-6 space-y-6">
          {/* Video Upload/URL Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TestTube2 className="h-5 w-5" />
                Video Source Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Custom URL Input */}
              <div className="space-y-2">
                <Label htmlFor="video-url">Video URL</Label>
                <div className="flex gap-2">
                  <Input
                    id="video-url"
                    placeholder="Enter video URL (mp4, webm, etc.)"
                    value={customVideoUrl}
                    onChange={(e) => setCustomVideoUrl(e.target.value)}
                    data-testid="input-video-url"
                  />
                  <Button onClick={handleCustomVideo} data-testid="button-load-video">
                    <Play className="h-4 w-4 mr-2" />
                    Load Video
                  </Button>
                </div>
              </div>

              {/* File Upload */}
              <div className="space-y-2">
                <Label htmlFor="video-file">Upload Video File</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="video-file"
                    type="file"
                    accept="video/*"
                    onChange={handleFileUpload}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    data-testid="input-video-file"
                  />
                  <Upload className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              {/* Sample Videos */}
              <div className="space-y-2">
                <Label>Sample Test Videos</Label>
                <div className="flex flex-wrap gap-2">
                  {SAMPLE_VIDEOS.map((video, index) => (
                    <Button
                      key={index}
                      variant={selectedVideo === video.url ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSelectedVideo(video.url);
                        setShowInCameraFeed(true);
                      }}
                      data-testid={`button-sample-video-${index}`}
                    >
                      {video.name}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Video Player Test */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                Direct Video Player
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="aspect-video max-w-2xl">
                <VideoPlayer
                  src={selectedVideo}
                  controls={true}
                  autoPlay={true}
                  muted={true}
                  className="w-full h-full"
                />
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Badge variant="outline">
                  Source: {selectedVideo ? new URL(selectedVideo).hostname : 'None'}
                </Badge>
                <Badge variant={selectedVideo ? "default" : "secondary"}>
                  {selectedVideo ? "Video Loaded" : "No Video"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Camera Feed Integration Test */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Video className="h-5 w-5" />
                  Camera Feed Integration
                </CardTitle>
                <Button
                  variant={showInCameraFeed ? "default" : "outline"}
                  onClick={() => setShowInCameraFeed(!showInCameraFeed)}
                  data-testid="button-toggle-camera-feed"
                >
                  {showInCameraFeed ? "Show Placeholder" : "Show Real Video"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Test camera feeds with video */}
                {[0, 1, 2].map((index) => (
                  <div key={index} className="space-y-2">
                    <CameraFeed
                      camera={{
                        ...testCamera,
                        id: `test-cam-${index + 1}`,
                        name: `Test Camera ${index + 1}`,
                        location: `Location ${index + 1}`
                      }}
                      hasAlert={index === 0}
                      hasOffender={index === 1}
                      showDetails={true}
                      useRealVideo={showInCameraFeed}
                      videoSrc={selectedVideo}
                      className="h-48"
                      data-testid={`camera-feed-test-${index}`}
                    />
                    <p className="text-sm text-muted-foreground text-center">
                      Test Camera {index + 1}
                    </p>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Integration Status</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={showInCameraFeed ? "default" : "secondary"}>
                    Real Video: {showInCameraFeed ? "Enabled" : "Disabled"}
                  </Badge>
                  <Badge variant={selectedVideo ? "default" : "destructive"}>
                    Video Source: {selectedVideo ? "Available" : "Missing"}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <Card>
            <CardHeader>
              <CardTitle>How to Test Your Video</CardTitle>
            </CardHeader>
            <CardContent className="prose prose-sm max-w-none">
              <ol className="space-y-2">
                <li>
                  <strong>Upload a file:</strong> Use the file input to upload your test video directly
                </li>
                <li>
                  <strong>Use a URL:</strong> Paste a direct link to your video file (must be publicly accessible)
                </li>
                <li>
                  <strong>Try samples:</strong> Click the sample video buttons to test with provided videos
                </li>
                <li>
                  <strong>Test integration:</strong> Toggle "Show Real Video" to see how it looks in camera feeds
                </li>
                <li>
                  <strong>Check compatibility:</strong> Supports MP4, WebM, and other HTML5 video formats
                </li>
              </ol>
              
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Note:</strong> For best results, use MP4 format with H.264 encoding. 
                  Large files may take time to load.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
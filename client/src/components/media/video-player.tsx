import { useRef, useEffect, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface VideoPlayerProps {
  src?: string;
  poster?: string;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  controls?: boolean;
  className?: string;
  onError?: (error: any) => void;
  onLoadedData?: () => void;
  fallbackContent?: React.ReactNode;
}

export function VideoPlayer({
  src,
  poster,
  autoPlay = true,
  muted = true,
  loop = true,
  controls = false,
  className = "",
  onError,
  onLoadedData,
  fallbackContent
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    const handleLoadedData = () => {
      setIsLoaded(true);
      setHasError(false);
      onLoadedData?.();
      
      if (autoPlay) {
        video.play().catch(error => {
          console.warn('Autoplay failed:', error);
          setIsPlaying(false);
        });
      }
    };

    const handleError = (error: any) => {
      console.error('Video error:', error);
      setHasError(true);
      setIsLoaded(false);
      onError?.(error);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('error', handleError);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    return () => {
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('error', handleError);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
    };
  }, [src, autoPlay, onError, onLoadedData]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch(error => {
        console.warn('Play failed:', error);
      });
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.requestFullscreen().catch(error => {
        console.warn('Fullscreen failed:', error);
      });
    }
  };

  // Show fallback content if no source provided
  if (!src) {
    return (
      <div className={cn("relative bg-slate-800 rounded-lg overflow-hidden", className)}>
        {fallbackContent || (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-white/70">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">No video source</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("relative bg-black rounded-lg overflow-hidden group", className)}>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        controls={controls}
        className="w-full h-full object-cover"
        playsInline
        preload="metadata"
        data-testid="video-player"
      />

      {/* Error State */}
      {hasError && (
        <div className="absolute inset-0 bg-red-900/50 flex items-center justify-center">
          <div className="text-center text-white">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">Failed to load video</p>
            <p className="text-xs opacity-75">Check video source or format</p>
          </div>
        </div>
      )}

      {/* Loading State */}
      {!isLoaded && !hasError && src && (
        <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center">
          <div className="text-center text-white">
            <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-2"></div>
            <p className="text-sm">Loading video...</p>
          </div>
        </div>
      )}

      {/* Custom Controls Overlay */}
      {!controls && isLoaded && !hasError && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors">
          <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={togglePlay}
                className="bg-black/50 text-white border-white/20"
                data-testid="button-video-play"
              >
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </Button>
              
              <Button
                size="sm"
                variant="secondary"
                onClick={toggleMute}
                className="bg-black/50 text-white border-white/20"
                data-testid="button-video-mute"
              >
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
            </div>

            <Button
              size="sm"
              variant="secondary"
              onClick={toggleFullscreen}
              className="bg-black/50 text-white border-white/20"
              data-testid="button-video-fullscreen"
            >
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Live Indicator */}
      {isLoaded && !hasError && (
        <div className="absolute top-2 right-2">
          <div className="bg-red-500 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            LIVE
          </div>
        </div>
      )}
    </div>
  );
}
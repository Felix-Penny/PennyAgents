import React, { useEffect, useState, useRef } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';

interface Detection {
  class: string;
  confidence: number;
  bbox: [number, number, number, number];
}

interface AnalysisResult {
  cameraId: string;
  timestamp: string;
  detections: Detection[];
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  metadata?: any;
}

interface AlertData {
  id: string;
  storeId: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  timestamp: string;
  cameraId?: string;
  metadata?: any;
}

export function LiveMonitoring() {
  const [isConnected, setIsConnected] = useState(false);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [analysisResults, setAnalysisResults] = useState<Record<string, AnalysisResult>>({});
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        setConnectionStatus('Connected');
        console.log('WebSocket connected');
        
        // Subscribe to test camera for demo
        ws.send(JSON.stringify({
          type: 'subscribe-camera',
          cameraId: 'test-camera-1'
        }));
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setConnectionStatus('Disconnected');
        console.log('WebSocket disconnected');
        
        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          if (!isConnected) {
            connectWebSocket();
          }
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('Error');
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
      setConnectionStatus('Failed');
    }
  };

  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'analysis-result':
        setAnalysisResults(prev => ({
          ...prev,
          [message.data.cameraId]: message.data
        }));
        break;

      case 'new-alert':
        setAlerts(prev => [message.data, ...prev].slice(0, 10));
        break;

      case 'subscription-confirmed':
        console.log(`Subscribed to camera: ${message.cameraId}`);
        break;

      case 'camera-status':
        console.log(`Camera status update:`, message);
        break;

      case 'pong':
        console.log('Received pong');
        break;

      default:
        console.log('Unknown message type:', message.type);
    }
  };

  const simulateFrame = async () => {
    try {
      const response = await fetch('/api/test/simulate-frame', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cameraId: 'test-camera-1'
        })
      });

      const result = await response.json();
      console.log('Frame simulation result:', result);
    } catch (error) {
      console.error('Error simulating frame:', error);
    }
  };

  const simulateAlert = async () => {
    try {
      const response = await fetch('/api/test/simulate-alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          severity: 'high',
          message: 'Test high-priority alert from dashboard'
        })
      });

      const result = await response.json();
      console.log('Alert simulation result:', result);
    } catch (error) {
      console.error('Error simulating alert:', error);
    }
  };

  const broadcastAnalysis = async () => {
    try {
      const response = await fetch('/api/test/broadcast-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cameraId: 'test-camera-1'
        })
      });

      const result = await response.json();
      console.log('Broadcast analysis result:', result);
    } catch (error) {
      console.error('Error broadcasting analysis:', error);
    }
  };

  const getThreatLevelColor = (level: string) => {
    switch (level) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Live Monitoring Dashboard</h1>
        <div className="flex items-center gap-4">
          <Badge variant={isConnected ? 'default' : 'destructive'}>
            {connectionStatus}
          </Badge>
          <div className="flex gap-2">
            <Button onClick={simulateFrame} size="sm">
              Simulate Frame
            </Button>
            <Button onClick={simulateAlert} size="sm" variant="outline">
              Simulate Alert
            </Button>
            <Button onClick={broadcastAnalysis} size="sm" variant="outline">
              Broadcast Analysis
            </Button>
          </div>
        </div>
      </div>

      {/* Real-time Alerts */}
      <div className="space-y-2">
        <h2 className="text-xl font-semibold">Recent Alerts</h2>
        {alerts.length === 0 ? (
          <Card className="p-4">
            <p className="text-gray-500">No recent alerts</p>
          </Card>
        ) : (
          alerts.map((alert, idx) => (
            <Alert 
              key={`${alert.id}-${idx}`} 
              variant={alert.severity === 'critical' || alert.severity === 'high' ? 'destructive' : 'default'}
            >
              <AlertDescription className="flex justify-between items-center">
                <div>
                  <strong>{alert.title}</strong> - {alert.description}
                  <br />
                  <small className="text-gray-500">
                    {new Date(alert.timestamp).toLocaleTimeString()}
                  </small>
                </div>
                <Badge className={getThreatLevelColor(alert.severity)}>
                  {alert.severity}
                </Badge>
              </AlertDescription>
            </Alert>
          ))
        )}
      </div>

      {/* Camera Analysis Results */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Live Camera Analysis</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Object.entries(analysisResults).map(([cameraId, result]) => (
            <Card key={cameraId} className="p-4">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-semibold">Camera: {cameraId}</h3>
                <Badge className={getThreatLevelColor(result.threatLevel)}>
                  {result.threatLevel}
                </Badge>
              </div>
              
              {/* Mock video area with detections overlay */}
              <div className="aspect-video bg-gray-900 rounded mb-4 relative">
                <div className="absolute inset-0 flex items-center justify-center text-white">
                  <span>Live Feed (Mock)</span>
                </div>
                
                {/* Overlay detections */}
                {result.detections.map((detection, idx) => (
                  <div
                    key={idx}
                    className="absolute border-2 border-red-500 bg-red-500/10"
                    style={{
                      left: `${detection.bbox[0] * 100}%`,
                      top: `${detection.bbox[1] * 100}%`,
                      width: `${(detection.bbox[2] - detection.bbox[0]) * 100}%`,
                      height: `${(detection.bbox[3] - detection.bbox[1]) * 100}%`,
                    }}
                  >
                    <span className="text-xs bg-red-500 text-white px-1 absolute -top-6">
                      {detection.class} {Math.round(detection.confidence * 100)}%
                    </span>
                  </div>
                ))}
              </div>
              
              {/* Detection Summary */}
              <div className="space-y-2">
                <p className="text-sm">
                  <strong>Detections:</strong> {result.detections.length}
                </p>
                {result.detections.map((detection, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{detection.class}</span>
                    <span>{Math.round(detection.confidence * 100)}%</span>
                  </div>
                ))}
                <p className="text-xs text-gray-500">
                  Last update: {new Date(result.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </Card>
          ))}
          
          {/* Placeholder for when no analysis results */}
          {Object.keys(analysisResults).length === 0 && (
            <Card className="p-4 lg:col-span-2">
              <p className="text-gray-500 text-center py-8">
                No live analysis data. Click "Simulate Frame" or "Broadcast Analysis" to see results.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* WebSocket Debug Info */}
      <Card className="p-4">
        <h3 className="font-semibold mb-2">Debug Information</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>Connection Status:</strong> {connectionStatus}
          </div>
          <div>
            <strong>Active Cameras:</strong> {Object.keys(analysisResults).length}
          </div>
          <div>
            <strong>Total Alerts:</strong> {alerts.length}
          </div>
          <div>
            <strong>WebSocket URL:</strong> {window.location.host}/ws
          </div>
        </div>
      </Card>
    </div>
  );
}
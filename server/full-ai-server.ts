import 'dotenv/config';
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { randomUUID } from "crypto";

function log(message: string) {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [express] ${message}`);
}

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Basic API routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    message: 'PennyProtect AI System - Full Backend Operational',
    features: {
      api: 'enabled',
      websocket: 'enabled',
      modal_ai: 'available'
    }
  });
});

app.get('/api/ai/health', async (req, res) => {
  try {
    // Test the Modal AI bridge
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const command = `python3 server/services/modal_bridge.py health`;
    const { stdout } = await execAsync(command);
    const result = JSON.parse(stdout.trim());
    
    res.json({
      backend: 'healthy',
      modal_ai: result,
      timestamp: new Date().toISOString(),
      websocket_clients: connectedClients.size
    });
  } catch (error: any) {
    res.status(500).json({
      backend: 'healthy',
      modal_ai: { status: 'error', error: error?.message || 'Unknown error' },
      timestamp: new Date().toISOString(),
      websocket_clients: connectedClients.size
    });
  }
});

app.get('/api/ai/test-analysis', async (req, res) => {
  try {
    // Test analysis with the AI service
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Create a 1x1 pixel PNG as base64
    const testFrame = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    
    const command = `python3 server/services/modal_bridge.py analyze "test-camera" "${testFrame}"`;
    const { stdout } = await execAsync(command);
    const result = JSON.parse(stdout.trim());
    
    // Broadcast to WebSocket clients
    broadcastToClients('analysis_result', {
      camera_id: 'test-camera',
      timestamp: new Date().toISOString(),
      result: result
    });
    
    res.json({
      status: 'success',
      test_result: result,
      timestamp: new Date().toISOString(),
      broadcasted_to_clients: connectedClients.size
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Serve test client
app.get('/test', (req, res) => {
  res.sendFile(__dirname + '/../test-client.html');
});

// WebSocket client management
const connectedClients = new Map();

function broadcastToClients(type: string, data: any) {
  const message = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
  let broadcastCount = 0;
  
  for (const [clientId, ws] of Array.from(connectedClients.entries())) {
    if (ws.readyState === 1) { // WebSocket.OPEN
      try {
        ws.send(message);
        broadcastCount++;
      } catch (error) {
        console.error(`Failed to send to client ${clientId}:`, error);
        connectedClients.delete(clientId);
      }
    } else {
      connectedClients.delete(clientId);
    }
  }
  
  log(`Broadcasted ${type} to ${broadcastCount} clients`);
  return broadcastCount;
}

// Error handler
app.use((err: any, req: any, res: any, next: any) => {
  console.error('Server Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Create HTTP server
const server = createServer(app);

// Setup WebSocket server
const wss = new WebSocketServer({ 
  server: server,
  path: '/ws',
  perMessageDeflate: false
});

wss.on('connection', (ws, request) => {
  const clientId = randomUUID();
  const remoteAddress = request.socket.remoteAddress || 'unknown';
  
  log(`WebSocket client connected: ${clientId} from ${remoteAddress}`);
  
  // Store client connection
  connectedClients.set(clientId, ws);
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    data: { 
      clientId,
      message: 'Connected to PennyProtect AI System',
      features: ['real-time-analysis', 'alerts', 'status-updates']
    },
    timestamp: new Date().toISOString()
  }));

  // Handle incoming messages
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      log(`Message from ${clientId}: ${data.type}`);
      
      // Echo back for testing
      ws.send(JSON.stringify({
        type: 'echo',
        data: { originalMessage: data, clientId },
        timestamp: new Date().toISOString()
      }));
    } catch (error) {
      console.error(`Error parsing message from ${clientId}:`, error);
    }
  });

  // Handle client disconnect
  ws.on('close', () => {
    connectedClients.delete(clientId);
    log(`WebSocket client disconnected: ${clientId}`);
  });

  ws.on('error', (error) => {
    console.error(`WebSocket error for client ${clientId}:`, error);
    connectedClients.delete(clientId);
  });
});

// Start server
const port = parseInt(process.env.PORT || '3005', 10);

server.listen(port, "127.0.0.1", () => {
  log(`🚀 PennyProtect AI System running on port ${port}`);
  log(`📡 Modal AI Service: Available`);
  log(`🔌 WebSocket Server: ws://localhost:${port}/ws`);
  log(`🌐 Health Check: http://localhost:${port}/api/health`);
  log(`🤖 AI Health: http://localhost:${port}/api/ai/health`);
  log(`🧪 Test Analysis: http://localhost:${port}/api/ai/test-analysis`);
  log(`✅ Full AI System with WebSocket Integration Ready`);
});
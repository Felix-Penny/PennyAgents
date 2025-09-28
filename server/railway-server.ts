import 'dotenv/config';
import express from "express";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { randomUUID } from "crypto";
import cors from 'cors';

function log(message: string) {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [pennyprotect] ${message}`);
}

const app = express();

// CORS configuration for your domain
app.use(cors({
  origin: [
    'https://www.pennyagents.com',
    'https://pennyagents.com',
    'https://api.pennyagents.com',
    ...(process.env.NODE_ENV === 'development' ? ['http://localhost:3000', 'http://localhost:5173'] : [])
  ],
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check endpoint (required by Railway)
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    message: 'PennyProtect AI System - Production Backend',
    service: 'pennyprotect-backend',
    version: '1.0.0',
    features: {
      api: 'enabled',
      websocket: 'enabled',
      modal_ai: 'available',
      twilio: 'configured'
    }
  });
});

// AI Health check
app.get('/api/ai/health', async (req, res) => {
  try {
    // In production, we'll check if Modal service is accessible
    const modalEndpoint = process.env.MODAL_ENDPOINT;
    
    if (!modalEndpoint) {
      throw new Error('Modal endpoint not configured');
    }
    
    // For now, return a mock response
    const result = {
      status: 'healthy',
      service: 'modal-ai',
      endpoint: modalEndpoint,
      message: 'Modal AI service available'
    };
    
    res.json({
      backend: 'healthy',
      modal_ai: result,
      timestamp: new Date().toISOString(),
      websocket_clients: connectedClients.size,
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error: any) {
    res.status(500).json({
      backend: 'healthy',
      modal_ai: { status: 'error', error: error?.message || 'Unknown error' },
      timestamp: new Date().toISOString(),
      websocket_clients: connectedClients.size,
      environment: process.env.NODE_ENV || 'development'
    });
  }
});

// AI Analysis Test
app.get('/api/ai/test-analysis', async (req, res) => {
  try {
    // In production, we'll make HTTP requests to Modal
    const modalEndpoint = process.env.MODAL_ENDPOINT;
    
    if (!modalEndpoint) {
      throw new Error('Modal endpoint not configured');
    }
    
    // Mock result for now - in production this will be a real Modal API call
    const result = {
      status: 'success',
      detections: [
        { class: 'person', confidence: 0.95, bbox: [100, 100, 200, 300] },
        { class: 'bag', confidence: 0.87, bbox: [150, 200, 250, 350] }
      ],
      faces_detected: 1,
      behavioral_analysis: {
        suspicious_activity: false,
        confidence: 0.92
      },
      processing_time_ms: 1234
    };
    
    // Broadcast to WebSocket clients
    const broadcastCount = broadcastToClients('analysis_result', {
      camera_id: 'test-camera',
      timestamp: new Date().toISOString(),
      result: result
    });
    
    res.json({
      status: 'success',
      test_result: result,
      timestamp: new Date().toISOString(),
      broadcasted_to_clients: broadcastCount,
      environment: process.env.NODE_ENV || 'development',
      modal_endpoint: modalEndpoint
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  }
});

// Twilio Webhook Endpoints
app.post('/api/webhooks/twilio', (req, res) => {
  log('📞 Twilio Webhook received');
  console.log('Webhook body:', req.body);
  
  const { MessageStatus, MessageSid, To, From, Body } = req.body;
  
  // Handle delivery status updates
  if (MessageStatus) {
    switch (MessageStatus) {
      case 'delivered':
        log(`✅ Alert ${MessageSid} delivered to ${To}`);
        break;
      case 'failed':
        log(`❌ Alert ${MessageSid} failed to ${To}`);
        break;
      case 'undelivered':
        log(`⚠️ Alert ${MessageSid} undelivered to ${To}`);
        break;
    }
  }
  
  // Handle incoming messages (replies)
  if (Body && From) {
    log(`📨 Incoming message from ${From}: ${Body}`);
    handleIncomingMessage(From, Body.trim());
  }
  
  // Respond with empty TwiML (required by Twilio)
  res.type('text/xml');
  res.send('<Response></Response>');
});

app.post('/api/twilio/status', (req, res) => {
  log('📊 Twilio Status Callback');
  console.log('Status body:', req.body);
  res.status(200).send('OK');
});

// Handle incoming message commands
function handleIncomingMessage(from: string, body: string) {
  const command = body.toUpperCase();
  
  switch (command) {
    case 'STOP':
    case 'UNSUBSCRIBE':
      log(`🚫 User ${from} opted out of alerts`);
      break;
    case 'STATUS':
      log(`📊 User ${from} requested system status`);
      // TODO: Send status message back
      break;
    case 'HELP':
      log(`🆘 User ${from} requested help`);
      // TODO: Send help message back
      break;
  }
}

// WebSocket client management
const connectedClients = new Map();

function broadcastToClients(type: string, data: any): number {
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
  
  if (broadcastCount > 0) {
    log(`Broadcasted ${type} to ${broadcastCount} clients`);
  }
  return broadcastCount;
}

// Serve test client
app.get('/test', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>PennyProtect AI Test</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; padding: 20px; }
            .status { padding: 10px; margin: 10px 0; border-radius: 5px; }
            .healthy { background: #d4edda; color: #155724; }
            .error { background: #f8d7da; color: #721c24; }
        </style>
    </head>
    <body>
        <h1>🛡️ PennyProtect AI System Test</h1>
        <div id="status" class="status">Loading...</div>
        <button onclick="testHealth()">Test Health</button>
        <button onclick="testAI()">Test AI Analysis</button>
        
        <script>
            async function testHealth() {
                try {
                    const response = await fetch('/api/health');
                    const data = await response.json();
                    document.getElementById('status').innerHTML = 
                        '<div class="healthy">✅ System Healthy: ' + data.message + '</div>';
                } catch (error) {
                    document.getElementById('status').innerHTML = 
                        '<div class="error">❌ System Error: ' + error.message + '</div>';
                }
            }
            
            async function testAI() {
                try {
                    document.getElementById('status').innerHTML = 
                        '<div class="status">🧪 Testing AI Analysis...</div>';
                    const response = await fetch('/api/ai/test-analysis');
                    const data = await response.json();
                    document.getElementById('status').innerHTML = 
                        '<div class="healthy">✅ AI Test Complete: ' + JSON.stringify(data.test_result).substring(0, 100) + '...</div>';
                } catch (error) {
                    document.getElementById('status').innerHTML = 
                        '<div class="error">❌ AI Test Failed: ' + error.message + '</div>';
                }
            }
            
            // Auto-test on load
            testHealth();
        </script>
    </body>
    </html>
  `);
});

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
      environment: process.env.NODE_ENV || 'development'
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
const port = parseInt(process.env.PORT || '3000', 10);

server.listen(port, '0.0.0.0', () => {
  log(`🚀 PennyProtect Production Backend running on port ${port}`);
  log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
  log(`📡 Modal AI Service: ${process.env.MODAL_ENDPOINT || 'Not configured'}`);
  log(`🔌 WebSocket Server: ws://localhost:${port}/ws`);
  log(`🌐 Health Check: http://localhost:${port}/api/health`);
  log(`🤖 AI Health: http://localhost:${port}/api/ai/health`);
  log(`🧪 Test Page: http://localhost:${port}/test`);
  log(`📞 Twilio Webhooks: Ready`);
  log(`✅ PennyProtect Backend Ready for Production`);
});
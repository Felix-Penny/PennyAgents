import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { createServer } from 'http';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://pennyagents.com', 'https://www.pennyagents.com']
    : true,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'pennyprotect-backend',
    port: PORT
  });
});

// AI health check
app.get('/api/ai/health', (req, res) => {
  res.json({ 
    status: 'ai-ready', 
    timestamp: new Date().toISOString(),
    services: ['yolo', 'face-recognition', 'behavior-analysis']
  });
});

// Twilio webhook handler
app.post('/api/webhooks/twilio', (req, res) => {
  console.log('Twilio webhook received:', req.body);
  res.status(200).send('OK');
});

// Main route
app.get('/', (req, res) => {
  res.json({ 
    message: 'PennyProtect Backend API',
    version: '1.0.0',
    status: 'running'
  });
});

// Create HTTP server
const server = createServer(app);

// WebSocket server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('New WebSocket connection');
  
  ws.on('message', (message) => {
    console.log('WebSocket message:', message.toString());
    ws.send(JSON.stringify({ 
      type: 'response',
      data: 'Message received',
      timestamp: new Date().toISOString()
    }));
  });
  
  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 PennyProtect Backend running on port ${PORT}`);
  console.log(`📡 WebSocket server ready`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
});
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

console.log('=== PennyProtect Backend Starting ===');
console.log('Node version:', process.version);
console.log('PORT:', PORT);
console.log('All environment variables:');
Object.keys(process.env).forEach(key => {
  if (key.startsWith('RAILWAY_') || key.startsWith('TWILIO_') || key.startsWith('MODAL_')) {
    console.log(`${key}:`, process.env[key]);
  }
});

// CORS
app.use(cors({
  origin: [
    'https://www.pennyagents.com',
    'https://pennyagents.com'
  ],
  credentials: true
}));

app.use(express.json());

// Health endpoint
app.get('/api/health', (req, res) => {
  console.log('Health check requested');
  res.json({ 
    status: 'healthy',
    service: 'pennyprotect-backend',
    timestamp: new Date().toISOString(),
    port: PORT,
    node: process.version,
    env: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  console.log('Root endpoint requested');
  res.json({ 
    message: 'PennyProtect Backend API',
    status: 'operational',
    timestamp: new Date().toISOString()
  });
});

// AI health endpoint
app.get('/api/ai/health', (req, res) => {
  console.log('AI health check requested');
  res.json({ 
    status: 'ai-ready',
    backend: 'healthy',
    timestamp: new Date().toISOString(),
    modal_configured: !!process.env.MODAL_APP_NAME
  });
});

// Twilio webhook
app.post('/api/webhooks/twilio', (req, res) => {
  console.log('Twilio webhook received:', req.body);
  res.status(200).send('OK');
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 PennyProtect Backend running on port ${PORT}`);
  console.log(`📍 Health: http://0.0.0.0:${PORT}/api/health`);
  console.log(`🤖 AI Health: http://0.0.0.0:${PORT}/api/ai/health`);
  console.log('✅ Server ready!');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received');
  server.close(() => {
    console.log('Server closed');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received');  
  server.close(() => {
    console.log('Server closed');
  });
});
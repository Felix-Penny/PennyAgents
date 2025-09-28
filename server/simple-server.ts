import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { setupVite, serveStatic, log } from "./vite";
import { createServer } from "http";

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Basic routes
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    message: 'PennyProtect AI System - Backend Operational'
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
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      backend: 'healthy',
      modal_ai: { status: 'error', error: error?.message || 'Unknown error' },
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/ai/test-analysis', async (req, res) => {
  try {
    // Test analysis with the AI service
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Create a simple base64 test image
    const testFrame = Buffer.from('test-frame-data').toString('base64');
    
    const command = `python3 server/services/modal_bridge.py analyze "test-camera" "${testFrame}"`;
    const { stdout } = await execAsync(command);
    const result = JSON.parse(stdout.trim());
    
    res.json({
      status: 'success',
      test_result: result,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      error: error?.message || 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// Error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
(async () => {
  const server = createServer(app);

  const port = parseInt(process.env.PORT || '5000', 10);

  // Setup Vite in development AFTER our API routes are defined
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  server.listen(port, "127.0.0.1", () => {
    log(`🚀 PennyProtect AI System running on port ${port}`);
    log(`📡 Modal AI Service: Available`);
    log(`🌐 Health Check: http://localhost:${port}/api/health`);
    log(`🤖 AI Health: http://localhost:${port}/api/ai/health`);
    log(`🧪 Test Analysis: http://localhost:${port}/api/ai/test-analysis`);
    log(`🔍 NOTE: WebSocket features temporarily disabled for testing`);
  });
})();
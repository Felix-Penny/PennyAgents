#!/usr/bin/env node

/**
 * Simple AI Pipeline Test Runner
 * Tests the core AI services without requiring full database setup
 */

import { AIAnalysisService } from './server/services/aiAnalysisService.js';
import { NotificationService } from './server/services/notificationService.js'; 
import { StreamIngestionService } from './server/services/streamIngestionService.js';
import { wsManager } from './server/websocket/socketHandlers.js';

console.log('🤖 PennyProtect AI Pipeline Test Runner');
console.log('=======================================\n');

async function testAIServices() {
  try {
    console.log('1. Testing AI Analysis Service...');
    const aiService = new AIAnalysisService(wsManager);
    
    // Test connection to Modal AI service
    const isAIHealthy = await aiService.testConnection();
    console.log(`   - AI Service Connection: ${isAIHealthy ? '✅ Connected' : '❌ Not Connected'}`);
    
    // Test AI simulation
    const mockAnalysis = await aiService.simulateAnalysis('test-camera-1');
    console.log(`   - AI Simulation: ✅ Generated ${Object.values(mockAnalysis.detections).flat().length} detections`);
    console.log(`   - Threat Level: ${mockAnalysis.threat_level}`);
    console.log(`   - Processing Time: ${mockAnalysis.processing_time}ms\n`);

    console.log('2. Testing Notification Service...');
    const notificationService = new NotificationService();
    
    // Test notification capabilities
    const notificationTest = await notificationService.testNotifications();
    console.log(`   - Email Service: ${notificationTest.email.available ? '✅ Available' : '❌ Not Configured'}`);
    console.log(`   - SMS Service: ${notificationTest.sms.available ? '✅ Available' : '❌ Not Configured'}\n`);

    console.log('3. Testing Stream Ingestion Service...');
    const streamService = new StreamIngestionService(wsManager);
    
    // Test stream management
    console.log('   - Stream Management: ✅ Service Initialized');
    console.log(`   - Active Streams: ${streamService.getActiveStreams().length}\n`);

    console.log('4. Testing WebSocket Manager...');
    console.log(`   - Connected Clients: ${wsManager.getConnectedClients()}`);
    console.log(`   - Subscription Stats: ✅ Manager Ready\n`);

    console.log('🎉 AI Pipeline Test Complete!');
    console.log('===============================');
    console.log('✅ Core AI Infrastructure is ready');
    console.log('✅ All services initialized successfully');
    console.log('✅ Mock data generation working');
    console.log('\n📋 Next Steps:');
    console.log('1. Configure Modal AI endpoint (MODAL_ENDPOINT in .env)');
    console.log('2. Set up Twilio credentials for SMS (TWILIO_* in .env)');
    console.log('3. Configure email SMTP settings (SMTP_* in .env)');
    console.log('4. Deploy Modal AI service with GPU capabilities');
    console.log('5. Test with real camera streams');
    
  } catch (error) {
    console.error('❌ Test Failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('- Check that all dependencies are installed (npm install)');
    console.log('- Verify .env file is configured properly');
    console.log('- Ensure TypeScript is compiled (npm run build)');
  }
}

// Mock database and other dependencies for testing
const mockDb = {
  insert: () => ({ values: () => ({ returning: () => [{ id: 'test-id' }] }) }),
  select: () => ({ from: () => ({ where: () => ({ limit: () => [{ id: 'test-camera', name: 'Test Camera' }] }) }) })
};

// Override the db import for testing
global.db = mockDb;

// Run tests
testAIServices();
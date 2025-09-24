import { test, expect, type Page } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

/**
 * Test Suite 4: Performance Validation
 * 
 * OBJECTIVES:
 * - Measure frame capture and analysis response times (<5 seconds target)
 * - Test system behavior with 4x4 grid (16 cameras) under load
 * - Validate memory usage and cleanup during extended operation
 * - Test network bandwidth usage for simultaneous analysis requests
 * - Ensure rate limiting protection works without impacting legitimate usage
 */

test.describe('Performance Validation Tests', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await helpers.authenticateAndNavigate();
    await helpers.waitForWebSocketConnection();
  });

  test('should meet frame analysis response time requirements (<5s)', async ({ page }) => {
    const cameraIds = ['camera-1', 'camera-2', 'camera-3'];
    
    for (const cameraId of cameraIds) {
      const analysisMetrics = await helpers.measurePerformance(async () => {
        // Start analysis
        await helpers.toggleCameraAnalysis(cameraId, true);
        await helpers.toggleCameraPlayback(cameraId, true);
        
        // Wait for first analysis result
        await helpers.waitForAIAnalysisComplete(cameraId, 10000);
        
        return { cameraId };
      }, `Frame Analysis Response Time - ${cameraId}`);
      
      // Must complete within 5 seconds per requirement
      expect(analysisMetrics.performanceMetrics.duration).toBeLessThan(5000);
      
      console.log(`✅ ${cameraId} analysis time: ${analysisMetrics.performanceMetrics.duration}ms`);
      
      // Clean up for next test
      await helpers.toggleCameraAnalysis(cameraId, false);
    }
  });

  test('should handle 4x4 grid (16 cameras) under load', async ({ page }) => {
    // Set up maximum grid size
    await helpers.selectGridLayout('4x4');
    
    const startMemory = await helpers['getMemoryUsage']();
    console.log(`Starting memory usage: ${startMemory.toFixed(2)}MB`);
    
    // Start analysis on all 16 cameras
    const cameraIds = Array.from({ length: 16 }, (_, i) => `camera-${i + 1}`);
    
    const gridLoadMetrics = await helpers.measurePerformance(async () => {
      // Enable analysis on all cameras in batches to avoid overwhelming
      const batchSize = 4;
      for (let i = 0; i < cameraIds.length; i += batchSize) {
        const batch = cameraIds.slice(i, i + batchSize);
        
        // Start batch in parallel
        await Promise.all(batch.map(async (cameraId) => {
          await helpers.toggleCameraAnalysis(cameraId, true);
          await helpers.toggleCameraPlayback(cameraId, true);
        }));
        
        // Brief pause between batches
        await page.waitForTimeout(1000);
      }
      
      return { totalCameras: cameraIds.length };
    }, '4x4 Grid Full Load Initialization');
    
    // Should handle full grid activation within reasonable time
    expect(gridLoadMetrics.performanceMetrics.duration).toBeLessThan(30000); // 30 seconds max
    
    // Verify system remains responsive
    await page.waitForTimeout(5000);
    
    const gridSelector = page.locator('[data-testid="trigger-grid-layout"]');
    await expect(gridSelector).toBeEnabled();
    
    // Check UI responsiveness
    const uiResponseMetrics = await helpers.measurePerformance(async () => {
      await helpers.selectGridLayout('3x3');
      await helpers.selectGridLayout('4x4');
      return {};
    }, 'UI Responsiveness Under Load');
    
    expect(uiResponseMetrics.performanceMetrics.duration).toBeLessThan(3000);
    
    // Monitor memory usage
    const peakMemory = await helpers['getMemoryUsage']();
    console.log(`Peak memory usage: ${peakMemory.toFixed(2)}MB`);
    
    // Memory growth should be reasonable
    const memoryGrowth = peakMemory - startMemory;
    expect(memoryGrowth).toBeLessThan(200); // Allow 200MB growth for 16 cameras
    
    console.log(`Memory growth with 16 cameras: ${memoryGrowth.toFixed(2)}MB`);
  });

  test('should validate memory usage and cleanup during extended operation', async ({ page }) => {
    await helpers.selectGridLayout('3x3');
    const cameraIds = ['camera-1', 'camera-2', 'camera-3', 'camera-4'];
    
    const initialMemory = await helpers['getMemoryUsage']();
    const memoryMeasurements: number[] = [initialMemory];
    
    // Extended operation simulation: 10 cycles of analysis start/stop
    for (let cycle = 0; cycle < 10; cycle++) {
      // Start analysis on all cameras
      for (const cameraId of cameraIds) {
        await helpers.toggleCameraAnalysis(cameraId, true);
        await helpers.toggleCameraPlayback(cameraId, true);
      }
      
      // Run for a period
      await page.waitForTimeout(3000);
      
      // Stop analysis
      for (const cameraId of cameraIds) {
        await helpers.toggleCameraAnalysis(cameraId, false);
      }
      
      // Force garbage collection if available
      await page.evaluate(() => {
        if ((window as any).gc) {
          (window as any).gc();
        }
      });
      
      await page.waitForTimeout(1000);
      
      // Measure memory
      const currentMemory = await helpers['getMemoryUsage']();
      memoryMeasurements.push(currentMemory);
      
      console.log(`Cycle ${cycle + 1} memory: ${currentMemory.toFixed(2)}MB`);
    }
    
    const finalMemory = memoryMeasurements[memoryMeasurements.length - 1];
    const totalMemoryGrowth = finalMemory - initialMemory;
    
    // Memory growth should stabilize and not grow excessively
    expect(totalMemoryGrowth).toBeLessThan(100); // 100MB max growth
    
    // Check for memory stability (no major leaks)
    const recentMeasurements = memoryMeasurements.slice(-3);
    const memoryVariance = Math.max(...recentMeasurements) - Math.min(...recentMeasurements);
    expect(memoryVariance).toBeLessThan(50); // 50MB variance
    
    console.log(`✅ Extended operation memory growth: ${totalMemoryGrowth.toFixed(2)}MB`);
  });

  test('should measure network bandwidth usage for simultaneous analysis', async ({ page }) => {
    await helpers.selectGridLayout('2x2');
    const cameraIds = ['camera-1', 'camera-2', 'camera-3', 'camera-4'];
    
    // Monitor network requests
    const networkRequests: any[] = [];
    
    page.on('request', (request) => {
      if (request.url().includes('/api/')) {
        networkRequests.push({
          url: request.url(),
          method: request.method(),
          timestamp: Date.now()
        });
      }
    });
    
    // Start simultaneous analysis
    const networkTestMetrics = await helpers.measurePerformance(async () => {
      const analysisPromises = cameraIds.map(cameraId => {
        return Promise.resolve()
          .then(() => helpers.toggleCameraAnalysis(cameraId, true))
          .then(() => helpers.toggleCameraPlayback(cameraId, true));
      });
      
      await Promise.all(analysisPromises);
      
      // Wait for network activity to settle
      await page.waitForTimeout(5000);
      
      return { cameras: cameraIds.length };
    }, 'Simultaneous Analysis Network Load');
    
    // Analyze network requests
    const analysisRequests = networkRequests.filter(req => 
      req.url.includes('/analyze') || req.url.includes('/detection')
    );
    
    console.log(`Network requests generated: ${networkRequests.length}`);
    console.log(`Analysis-specific requests: ${analysisRequests.length}`);
    
    // Should not overwhelm network with excessive requests
    expect(analysisRequests.length).toBeLessThan(50); // Reasonable limit
    
    // Network operation should complete efficiently
    expect(networkTestMetrics.performanceMetrics.duration).toBeLessThan(10000);
  });

  test('should validate rate limiting protection', async ({ page }) => {
    const cameraId = 'camera-1';
    
    // Rapidly trigger analysis operations to test rate limiting
    const rateLimitTestMetrics = await helpers.measurePerformance(async () => {
      const rapidRequests: Promise<void>[] = [];
      
      // Generate many rapid requests
      for (let i = 0; i < 20; i++) {
        rapidRequests.push(
          Promise.resolve()
            .then(() => helpers.toggleCameraAnalysis(cameraId, true))
            .then(() => page.waitForTimeout(100))
            .then(() => helpers.toggleCameraAnalysis(cameraId, false))
            .catch(() => {}) // Ignore rate limit errors
        );
      }
      
      await Promise.allSettled(rapidRequests);
      return { requests: rapidRequests.length };
    }, 'Rate Limiting Test');
    
    // System should handle rapid requests gracefully
    await page.waitForTimeout(2000);
    
    // Verify system is still responsive
    const analysisButton = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
    await expect(analysisButton).toBeEnabled();
    
    // Should be able to perform normal operation after rate limiting
    await helpers.toggleCameraAnalysis(cameraId, true);
    await page.waitForTimeout(1000);
    
    const isActive = await analysisButton.evaluate(el => el.classList.contains('ring-2'));
    expect(isActive).toBe(true);
    
    console.log(`✅ Rate limiting handled gracefully`);
  });

  test('should maintain performance across browser sessions', async ({ page }) => {
    // Test performance consistency across page reloads
    const sessionTests = [];
    
    for (let session = 0; session < 3; session++) {
      if (session > 0) {
        // Reload page to simulate new session
        await page.reload({ waitUntil: 'networkidle' });
        await helpers.waitForWebSocketConnection();
      }
      
      await helpers.selectGridLayout('2x2');
      
      const sessionMetrics = await helpers.measurePerformance(async () => {
        const cameraIds = ['camera-1', 'camera-2'];
        
        for (const cameraId of cameraIds) {
          await helpers.toggleCameraAnalysis(cameraId, true);
          await helpers.toggleCameraPlayback(cameraId, true);
        }
        
        await page.waitForTimeout(3000);
        
        return { session, cameras: cameraIds.length };
      }, `Session ${session + 1} Performance Test`);
      
      sessionTests.push(sessionMetrics.performanceMetrics.duration);
      
      // Clean up
      const cameraIds = ['camera-1', 'camera-2'];
      for (const cameraId of cameraIds) {
        await helpers.toggleCameraAnalysis(cameraId, false);
      }
    }
    
    // Performance should be consistent across sessions
    const avgPerformance = sessionTests.reduce((a, b) => a + b) / sessionTests.length;
    const maxVariance = Math.max(...sessionTests) - Math.min(...sessionTests);
    
    expect(maxVariance).toBeLessThan(2000); // 2 second variance max
    console.log(`✅ Session performance consistency: avg ${avgPerformance.toFixed(0)}ms, variance ${maxVariance.toFixed(0)}ms`);
  });

  test('should handle CPU-intensive operations without blocking UI', async ({ page }) => {
    await helpers.selectGridLayout('3x3');
    
    // Start intensive analysis operations
    const cameraIds = ['camera-1', 'camera-2', 'camera-3', 'camera-4', 'camera-5'];
    
    for (const cameraId of cameraIds) {
      await helpers.toggleCameraAnalysis(cameraId, true);
      await helpers.toggleCameraPlayback(cameraId, true);
    }
    
    // Inject multiple detections to increase processing load
    for (const cameraId of cameraIds) {
      for (let i = 0; i < 5; i++) {
        await helpers.injectMockDetection(cameraId, {
          id: `load-detection-${cameraId}-${i}`,
          confidence: 0.75,
          boundingBox: { x: 50 + (i * 20), y: 50, width: 80, height: 60 },
          label: `Load Test ${i}`,
          severity: 'medium'
        });
      }
    }
    
    // Test UI responsiveness during heavy processing
    const uiResponsivenessMetrics = await helpers.measurePerformance(async () => {
      // Test grid switching during load
      await helpers.selectGridLayout('2x2');
      await page.waitForTimeout(500);
      await helpers.selectGridLayout('3x3');
      
      // Test other UI interactions
      const gridSelector = page.locator('[data-testid="trigger-grid-layout"]');
      await gridSelector.click();
      await page.keyboard.press('Escape');
      
      return {};
    }, 'UI Responsiveness Under CPU Load');
    
    // UI should remain responsive (< 2 seconds for interactions)
    expect(uiResponsivenessMetrics.performanceMetrics.duration).toBeLessThan(2000);
    
    console.log(`✅ UI remained responsive during CPU load: ${uiResponsivenessMetrics.performanceMetrics.duration}ms`);
  });

  test('should validate WebSocket performance under load', async ({ page }) => {
    await helpers.selectGridLayout('4x4');
    
    // Monitor WebSocket message frequency
    const wsMessages: any[] = [];
    
    await page.evaluate(() => {
      const originalSend = WebSocket.prototype.send;
      WebSocket.prototype.send = function(data) {
        (window as any).__wsMessages = (window as any).__wsMessages || [];
        (window as any).__wsMessages.push({
          data: JSON.parse(data),
          timestamp: Date.now()
        });
        return originalSend.call(this, data);
      };
    });
    
    // Generate WebSocket load
    const cameraIds = Array.from({ length: 8 }, (_, i) => `camera-${i + 1}`);
    
    const wsLoadMetrics = await helpers.measurePerformance(async () => {
      // Start analysis on multiple cameras (generates WebSocket subscriptions)
      for (const cameraId of cameraIds) {
        await helpers.toggleCameraAnalysis(cameraId, true);
      }
      
      // Simulate status updates and heartbeats
      await page.waitForTimeout(10000); // 10 seconds of activity
      
      return { cameras: cameraIds.length };
    }, 'WebSocket Load Test');
    
    // Check WebSocket message volume
    const finalMessages = await page.evaluate(() => (window as any).__wsMessages || []);
    
    console.log(`WebSocket messages during load test: ${finalMessages.length}`);
    
    // Should handle reasonable message volume without performance degradation
    expect(wsLoadMetrics.performanceMetrics.duration).toBeLessThan(15000);
    
    // Verify WebSocket connection remains stable
    const isConnected = await helpers.checkWebSocketStatus();
    expect(isConnected).toBe(true);
  });
});
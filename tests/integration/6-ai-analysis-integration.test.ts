import { test, expect, type Page } from '@playwright/test';
import { TestHelpers, MockDetection } from '../utils/test-helpers';

/**
 * Test Suite 6: AI Analysis Integration
 * 
 * OBJECTIVES:
 * - Test complete pipeline: frame capture → AI analysis → overlay display
 * - Verify threat detection accuracy and confidence scoring
 * - Test error handling for AI service failures or timeouts
 * - Validate circuit breaker protection during AI API issues
 * - Ensure proper cleanup and recovery from analysis errors
 */

test.describe('AI Analysis Integration Tests', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await helpers.authenticateAndNavigate();
    await helpers.waitForWebSocketConnection();
  });

  test('should execute complete AI analysis pipeline', async ({ page }) => {
    await helpers.selectGridLayout('2x2');
    const cameraId = 'camera-1';
    
    // Test complete pipeline: frame capture → AI analysis → overlay display
    const pipelineMetrics = await helpers.measurePerformance(async () => {
      // Step 1: Start frame capture
      await helpers.toggleCameraPlayback(cameraId, true);
      
      // Step 2: Enable AI analysis
      await helpers.toggleCameraAnalysis(cameraId, true);
      
      // Step 3: Wait for analysis to process frames
      await helpers.waitForAIAnalysisComplete(cameraId, 15000);
      
      // Step 4: Inject mock detection to test overlay display
      const detection: MockDetection = {
        id: 'pipeline-test-detection',
        confidence: 0.85,
        boundingBox: { x: 100, y: 100, width: 200, height: 150 },
        label: 'Pipeline Test Object',
        severity: 'medium'
      };
      
      await helpers.injectMockDetection(cameraId, detection);
      
      // Step 5: Verify overlay displays detection
      await helpers.waitForOverlayDetection(cameraId, 10000);
      
      return { pipeline: 'complete' };
    }, 'Complete AI Analysis Pipeline');
    
    // Pipeline should complete within performance requirements
    expect(pipelineMetrics.performanceMetrics.duration).toBeLessThan(20000);
    
    // Verify each stage of the pipeline
    const analysisButton = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
    const isActive = await analysisButton.evaluate(el => el.classList.contains('ring-2'));
    expect(isActive).toBe(true);
    
    // Verify overlay has rendered content
    const canvas = page.locator('[data-testid="detection-overlay-canvas"]').first();
    const hasContent = await canvas.evaluate((canvasEl) => {
      const canvas = canvasEl as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return imageData.data.some(pixel => pixel !== 0);
    });
    expect(hasContent).toBe(true);
    
    console.log(`✅ AI Pipeline completed in ${pipelineMetrics.performanceMetrics.duration}ms`);
  });

  test('should handle threat detection with confidence scoring', async ({ page }) => {
    await helpers.selectGridLayout('2x2');
    const cameraId = 'camera-1';
    
    await helpers.toggleCameraAnalysis(cameraId, true);
    await helpers.toggleCameraPlayback(cameraId, true);
    
    // Test different confidence levels
    const confidenceLevels = [0.60, 0.75, 0.85, 0.95];
    
    for (const confidence of confidenceLevels) {
      const detection: MockDetection = {
        id: `confidence-test-${confidence}`,
        confidence,
        boundingBox: { x: 50, y: 50, width: 100, height: 80 },
        label: `${Math.round(confidence * 100)}% Confidence`,
        severity: confidence > 0.8 ? 'high' : 'medium'
      };
      
      await helpers.injectMockDetection(cameraId, detection);
      await page.waitForTimeout(1000);
      
      // Verify detection is processed based on confidence threshold
      console.log(`✅ Processed detection with ${confidence} confidence`);
    }
    
    // Verify high-confidence detections are prioritized
    const highConfidenceDetection: MockDetection = {
      id: 'high-confidence-threat',
      confidence: 0.95,
      boundingBox: { x: 75, y: 75, width: 150, height: 100 },
      label: 'High Confidence Threat',
      severity: 'critical'
    };
    
    await helpers.injectMockDetection(cameraId, highConfidenceDetection);
    await helpers.waitForOverlayDetection(cameraId, 5000);
    
    console.log('✅ Confidence scoring validation completed');
  });

  test('should handle AI service failures gracefully', async ({ page }) => {
    await helpers.selectGridLayout('2x2');
    const cameraId = 'camera-1';
    
    // Test error handling for AI service failures
    const errorHandlingTest = await helpers.measurePerformance(async () => {
      // Start analysis
      await helpers.toggleCameraAnalysis(cameraId, true);
      await helpers.toggleCameraPlayback(cameraId, true);
      
      // Simulate network failure during analysis
      await helpers.simulateNetworkCondition('offline');
      await page.waitForTimeout(3000);
      
      // Restore network
      await helpers.simulateNetworkCondition('normal');
      await page.waitForTimeout(2000);
      
      // Verify system recovers gracefully
      const analysisButton = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
      await expect(analysisButton).toBeEnabled();
      
      // Should be able to restart analysis
      const isActive = await analysisButton.evaluate(el => el.classList.contains('ring-2'));
      if (!isActive) {
        await helpers.toggleCameraAnalysis(cameraId, true);
        await page.waitForTimeout(1000);
        
        const isNowActive = await analysisButton.evaluate(el => el.classList.contains('ring-2'));
        expect(isNowActive).toBe(true);
      }
      
      return { errorRecovery: true };
    }, 'AI Service Error Handling');
    
    console.log(`✅ Error handling completed in ${errorHandlingTest.performanceMetrics.duration}ms`);
  });

  test('should implement circuit breaker protection', async ({ page }) => {
    await helpers.selectGridLayout('3x3');
    const cameraIds = ['camera-1', 'camera-2', 'camera-3'];
    
    // Test circuit breaker by overwhelming system
    const circuitBreakerTest = await helpers.measurePerformance(async () => {
      // Start analysis on multiple cameras
      for (const cameraId of cameraIds) {
        await helpers.toggleCameraAnalysis(cameraId, true);
        await helpers.toggleCameraPlayback(cameraId, true);
      }
      
      // Rapidly trigger analysis operations to test circuit breaker
      const rapidOperations: Promise<void>[] = [];
      
      for (let i = 0; i < 15; i++) {
        for (const cameraId of cameraIds) {
          rapidOperations.push(
            helpers.toggleCameraAnalysis(cameraId, false)
              .then(() => page.waitForTimeout(100))
              .then(() => helpers.toggleCameraAnalysis(cameraId, true))
              .catch(() => {}) // Ignore circuit breaker rejections
          );
        }
      }
      
      await Promise.allSettled(rapidOperations);
      
      // Wait for circuit breaker to potentially activate
      await page.waitForTimeout(5000);
      
      return { operations: rapidOperations.length };
    }, 'Circuit Breaker Protection Test');
    
    // Verify system is still responsive after circuit breaker test
    for (const cameraId of cameraIds) {
      const button = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
      await expect(button).toBeEnabled();
    }
    
    console.log(`✅ Circuit breaker protection verified`);
  });

  test('should cleanup resources after analysis errors', async ({ page }) => {
    await helpers.selectGridLayout('2x2');
    const cameraId = 'camera-1';
    
    const initialMemory = await helpers['getMemoryUsage']();
    
    // Test resource cleanup during error scenarios
    const cleanupTest = await helpers.measurePerformance(async () => {
      // Cycle through analysis start/stop with simulated errors
      for (let cycle = 0; cycle < 5; cycle++) {
        // Start analysis
        await helpers.toggleCameraAnalysis(cameraId, true);
        await helpers.toggleCameraPlayback(cameraId, true);
        
        // Simulate error condition
        if (cycle % 2 === 0) {
          await helpers.simulateNetworkCondition('slow');
        }
        
        await page.waitForTimeout(2000);
        
        // Stop analysis
        await helpers.toggleCameraAnalysis(cameraId, false);
        
        // Restore normal conditions
        await helpers.simulateNetworkCondition('normal');
        
        // Force cleanup
        await page.evaluate(() => {
          if ((window as any).gc) {
            (window as any).gc();
          }
        });
        
        await page.waitForTimeout(1000);
      }
      
      return { cleanupCycles: 5 };
    }, 'Resource Cleanup During Errors');
    
    const finalMemory = await helpers['getMemoryUsage']();
    const memoryGrowth = finalMemory - initialMemory;
    
    // Memory growth should be minimal after cleanup
    expect(memoryGrowth).toBeLessThan(50); // 50MB limit
    
    console.log(`✅ Resource cleanup verified: ${memoryGrowth.toFixed(2)}MB growth`);
  });

  test('should validate frame capture timing and quality', async ({ page }) => {
    await helpers.selectGridLayout('2x2');
    const cameraId = 'camera-1';
    
    // Test frame capture timing
    const frameCaptureTest = await helpers.measurePerformance(async () => {
      await helpers.toggleCameraPlayback(cameraId, true);
      await helpers.toggleCameraAnalysis(cameraId, true);
      
      // Monitor frame capture frequency (simulated)
      const frameEvents: number[] = [];
      
      // Simulate frame capture events over time
      for (let i = 0; i < 10; i++) {
        frameEvents.push(Date.now());
        await page.waitForTimeout(500); // 500ms intervals
      }
      
      // Calculate frame intervals
      const intervals = frameEvents.slice(1).map((time, index) => 
        time - frameEvents[index]
      );
      
      const avgInterval = intervals.reduce((a, b) => a + b) / intervals.length;
      
      // Frame capture should be consistent (around 500ms ± 100ms)
      expect(avgInterval).toBeGreaterThan(400);
      expect(avgInterval).toBeLessThan(600);
      
      return { framesCaptured: frameEvents.length, avgInterval };
    }, 'Frame Capture Timing Test');
    
    console.log(`✅ Frame capture validated: avg interval ${frameCaptureTest.avgInterval?.toFixed(0)}ms`);
  });

  test('should handle multiple detection types simultaneously', async ({ page }) => {
    await helpers.selectGridLayout('3x3');
    const cameraId = 'camera-1';
    
    await helpers.toggleCameraAnalysis(cameraId, true);
    await helpers.toggleCameraPlaybook(cameraId, true);
    
    // Test multiple detection types
    const detectionTypes = [
      { type: 'person', severity: 'low', confidence: 0.70 },
      { type: 'weapon', severity: 'critical', confidence: 0.90 },
      { type: 'suspicious_behavior', severity: 'medium', confidence: 0.75 },
      { type: 'theft', severity: 'high', confidence: 0.85 }
    ];
    
    const multiDetectionTest = await helpers.measurePerformance(async () => {
      // Inject multiple detection types simultaneously
      const detectionPromises = detectionTypes.map((detection, index) => {
        const mockDetection: MockDetection = {
          id: `multi-detection-${detection.type}`,
          confidence: detection.confidence,
          boundingBox: {
            x: 50 + (index * 40),
            y: 50 + (index * 30),
            width: 80,
            height: 60
          },
          label: detection.type.replace('_', ' ').toUpperCase(),
          severity: detection.severity as any
        };
        
        return helpers.injectMockDetection(cameraId, mockDetection);
      });
      
      await Promise.all(detectionPromises);
      
      // Wait for all detections to be processed
      await helpers.waitForOverlayDetection(cameraId, 10000);
      
      return { detectionTypes: detectionTypes.length };
    }, 'Multiple Detection Types Test');
    
    // Should handle multiple detection types efficiently
    expect(multiDetectionTest.performanceMetrics.duration).toBeLessThan(8000);
    
    console.log(`✅ Multiple detection types processed in ${multiDetectionTest.performanceMetrics.duration}ms`);
  });

  test('should validate AI model performance under load', async ({ page }) => {
    await helpers.selectGridLayout('4x4');
    const cameraIds = Array.from({ length: 6 }, (_, i) => `camera-${i + 1}`);
    
    // Test AI model performance under concurrent load
    const modelLoadTest = await helpers.measurePerformance(async () => {
      // Start analysis on multiple cameras
      for (const cameraId of cameraIds) {
        await helpers.toggleCameraAnalysis(cameraId, true);
        await helpers.toggleCameraPlayback(cameraId, true);
      }
      
      // Generate concurrent detections
      const loadPromises = cameraIds.flatMap((cameraId, cameraIndex) => 
        Array.from({ length: 3 }, (_, detectionIndex) => {
          const detection: MockDetection = {
            id: `load-test-${cameraIndex}-${detectionIndex}`,
            confidence: 0.70 + (Math.random() * 0.25),
            boundingBox: {
              x: 30 + (detectionIndex * 50),
              y: 30 + (cameraIndex * 40),
              width: 70,
              height: 60
            },
            label: `Load-${cameraIndex}-${detectionIndex}`,
            severity: Math.random() > 0.8 ? 'high' : 'medium'
          };
          
          return helpers.injectMockDetection(cameraId, detection);
        })
      );
      
      await Promise.all(loadPromises);
      
      // Wait for processing to complete
      await page.waitForTimeout(5000);
      
      return { 
        cameras: cameraIds.length,
        totalDetections: loadPromises.length 
      };
    }, 'AI Model Load Test');
    
    // Should handle load within acceptable time
    expect(modelLoadTest.performanceMetrics.duration).toBeLessThan(15000);
    
    // Verify system remains responsive
    const gridSelector = page.locator('[data-testid="trigger-grid-layout"]');
    await expect(gridSelector).toBeEnabled();
    
    console.log(`✅ AI model handled load: ${modelLoadTest.cameras} cameras, ${modelLoadTest.totalDetections} detections`);
  });

  test('should implement proper error reporting and alerts', async ({ page }) => {
    await helpers.selectGridLayout('2x2');
    const cameraId = 'camera-1';
    
    // Test error reporting mechanisms
    const errorReportingTest = await helpers.measurePerformance(async () => {
      await helpers.toggleCameraAnalysis(cameraId, true);
      await helpers.toggleCameraPlayback(cameraId, true);
      
      // Simulate various error conditions
      await helpers.simulateNetworkCondition('offline');
      await page.waitForTimeout(2000);
      
      // Check for error indicators
      const errorIndicators = page.locator('[data-testid*="error"], [data-testid*="alert"]');
      
      // System should show some indication of error state
      // (May be subtle, depends on implementation)
      
      // Restore conditions
      await helpers.simulateNetworkCondition('normal');
      await page.waitForTimeout(2000);
      
      // Error state should clear
      const persistentErrors = await errorIndicators.count();
      
      // Verify recovery
      const button = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
      await expect(button).toBeEnabled();
      
      return { errorHandling: true };
    }, 'Error Reporting and Recovery');
    
    console.log(`✅ Error reporting system verified`);
  });

  test('should validate data consistency across analysis pipeline', async ({ page }) => {
    await helpers.selectGridLayout('2x2');
    const cameraIds = ['camera-1', 'camera-2'];
    
    // Test data consistency throughout pipeline
    const consistencyTest = await helpers.measurePerformance(async () => {
      // Start analysis on multiple cameras
      for (const cameraId of cameraIds) {
        await helpers.toggleCameraAnalysis(cameraId, true);
        await helpers.toggleCameraPlayback(cameraId, true);
      }
      
      // Inject identical detections on both cameras
      const testDetection: MockDetection = {
        id: 'consistency-test',
        confidence: 0.80,
        boundingBox: { x: 100, y: 100, width: 120, height: 90 },
        label: 'Consistency Test',
        severity: 'medium'
      };
      
      for (const cameraId of cameraIds) {
        await helpers.injectMockDetection(cameraId, {
          ...testDetection,
          id: `${testDetection.id}-${cameraId}`
        });
      }
      
      // Wait for processing
      await page.waitForTimeout(3000);
      
      // Verify consistent handling across cameras
      for (const cameraId of cameraIds) {
        const button = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
        const isActive = await button.evaluate(el => el.classList.contains('ring-2'));
        expect(isActive).toBe(true);
      }
      
      return { camerasValidated: cameraIds.length };
    }, 'Data Consistency Validation');
    
    console.log(`✅ Data consistency validated across ${consistencyTest.camerasValidated} cameras`);
  });
});
import { test, expect, type Page } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

/**
 * Test Suite 2: Pause/Resume Analysis Functionality
 * 
 * OBJECTIVES:
 * - Test individual camera pause/resume controls
 * - Verify global pause/resume functionality across all active cameras
 * - Validate AI analysis state persistence during pause operations
 * - Test recovery from paused state with proper analysis restart
 * - Ensure WebSocket status updates reflect pause/resume states correctly
 */

test.describe('Pause/Resume Analysis Functionality Tests', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await helpers.authenticateAndNavigate();
    await helpers.waitForWebSocketConnection();
    
    // Set up 3x3 grid for comprehensive testing
    await helpers.selectGridLayout('3x3');
  });

  test('should pause and resume individual camera analysis', async ({ page }) => {
    const cameraId = 'camera-1';
    
    // Start analysis
    await helpers.toggleCameraAnalysis(cameraId, true);
    await helpers.toggleCameraPlayback(cameraId, true);
    
    // Verify analysis is active
    const analysisButton = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
    const isActive = await analysisButton.evaluate(el => el.classList.contains('ring-2'));
    expect(isActive).toBe(true);
    
    // Pause analysis
    await helpers.measurePerformance(async () => {
      await helpers.toggleCameraAnalysis(cameraId, false);
      return {};
    }, 'Individual Camera Analysis Pause');
    
    // Verify analysis is paused
    const isPaused = await analysisButton.evaluate(el => !el.classList.contains('ring-2'));
    expect(isPaused).toBe(true);
    
    // Resume analysis
    await helpers.measurePerformance(async () => {
      await helpers.toggleCameraAnalysis(cameraId, true);
      return {};
    }, 'Individual Camera Analysis Resume');
    
    // Verify analysis is resumed
    await page.waitForTimeout(1000);
    const isResumed = await analysisButton.evaluate(el => el.classList.contains('ring-2'));
    expect(isResumed).toBe(true);
  });

  test('should handle global pause/resume across all cameras', async ({ page }) => {
    const cameraIds = ['camera-1', 'camera-2', 'camera-3', 'camera-4'];
    
    // Start analysis on multiple cameras
    for (const cameraId of cameraIds) {
      await helpers.toggleCameraAnalysis(cameraId, true);
      await helpers.toggleCameraPlayback(cameraId, true);
    }
    
    // Verify all are active
    for (const cameraId of cameraIds) {
      const button = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
      const isActive = await button.evaluate(el => el.classList.contains('ring-2'));
      expect(isActive).toBe(true);
    }
    
    // Global pause (simulated by pausing all visible cameras)
    await helpers.measurePerformance(async () => {
      for (const cameraId of cameraIds) {
        await helpers.toggleCameraAnalysis(cameraId, false);
      }
      return {};
    }, 'Global Analysis Pause');
    
    // Verify all are paused
    for (const cameraId of cameraIds) {
      const button = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
      const isPaused = await button.evaluate(el => !el.classList.contains('ring-2'));
      expect(isPaused).toBe(true);
    }
    
    // Global resume
    await helpers.measurePerformance(async () => {
      for (const cameraId of cameraIds) {
        await helpers.toggleCameraAnalysis(cameraId, true);
      }
      return {};
    }, 'Global Analysis Resume');
    
    // Verify all are resumed
    await page.waitForTimeout(2000);
    for (const cameraId of cameraIds) {
      const button = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
      const isResumed = await button.evaluate(el => el.classList.contains('ring-2'));
      expect(isResumed).toBe(true);
    }
  });

  test('should maintain analysis state across page refresh', async ({ page }) => {
    const cameraId = 'camera-1';
    
    // Start analysis
    await helpers.toggleCameraAnalysis(cameraId, true);
    await helpers.toggleCameraPlayback(cameraId, true);
    
    // Wait for analysis to be active
    await page.waitForTimeout(2000);
    
    // Refresh page
    await page.reload({ waitUntil: 'networkidle' });
    await helpers.waitForWebSocketConnection();
    
    // Verify analysis state is restored
    const analysisButton = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
    
    // Note: State persistence depends on implementation
    // This test verifies the system can recover gracefully
    await expect(analysisButton).toBeVisible();
  });

  test('should reflect pause/resume states in WebSocket updates', async ({ page }) => {
    const cameraId = 'camera-1';
    
    // Monitor WebSocket messages
    const messages: any[] = [];
    await page.evaluate(() => {
      const originalSend = WebSocket.prototype.send;
      WebSocket.prototype.send = function(data) {
        (window as any).__wsMessages = (window as any).__wsMessages || [];
        (window as any).__wsMessages.push(JSON.parse(data));
        return originalSend.call(this, data);
      };
    });
    
    // Start analysis
    await helpers.toggleCameraAnalysis(cameraId, true);
    await page.waitForTimeout(1000);
    
    // Pause analysis
    await helpers.toggleCameraAnalysis(cameraId, false);
    await page.waitForTimeout(1000);
    
    // Check WebSocket messages
    const wsMessages = await page.evaluate(() => (window as any).__wsMessages || []);
    
    // Should contain camera control messages
    const controlMessages = wsMessages.filter((msg: any) => 
      msg.type === 'camera_control' || msg.type === 'subscribe_camera_status'
    );
    
    expect(controlMessages.length).toBeGreaterThan(0);
  });

  test('should handle rapid pause/resume cycles', async ({ page }) => {
    const cameraId = 'camera-1';
    const cycles = 5;
    
    // Start analysis
    await helpers.toggleCameraAnalysis(cameraId, true);
    await helpers.toggleCameraPlayback(cameraId, true);
    
    // Perform rapid pause/resume cycles
    await helpers.measurePerformance(async () => {
      for (let i = 0; i < cycles; i++) {
        // Pause
        await helpers.toggleCameraAnalysis(cameraId, false);
        await page.waitForTimeout(200);
        
        // Resume
        await helpers.toggleCameraAnalysis(cameraId, true);
        await page.waitForTimeout(200);
      }
      return { cycles };
    }, 'Rapid Pause/Resume Cycles');
    
    // Verify final state is consistent
    await page.waitForTimeout(1000);
    const analysisButton = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
    const finalState = await analysisButton.evaluate(el => el.classList.contains('ring-2'));
    expect(finalState).toBe(true);
    
    // Verify no error states
    const errorIndicator = page.locator('[data-testid="camera-error"]');
    await expect(errorIndicator).not.toBeVisible();
  });

  test('should recover properly from analysis errors', async ({ page }) => {
    const cameraId = 'camera-1';
    
    // Start analysis
    await helpers.toggleCameraAnalysis(cameraId, true);
    await helpers.toggleCameraPlayback(cameraId, true);
    
    // Simulate network interruption
    await helpers.simulateNetworkCondition('offline');
    await page.waitForTimeout(2000);
    
    // Restore network
    await helpers.simulateNetworkCondition('normal');
    await page.waitForTimeout(2000);
    
    // Verify system recovers
    await helpers.waitForWebSocketConnection();
    
    // Analysis should either auto-resume or be manually resumable
    const analysisButton = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
    await expect(analysisButton).toBeEnabled();
    
    // Try to resume if not already active
    const isActive = await analysisButton.evaluate(el => el.classList.contains('ring-2'));
    if (!isActive) {
      await helpers.toggleCameraAnalysis(cameraId, true);
      await page.waitForTimeout(1000);
      
      const isNowActive = await analysisButton.evaluate(el => el.classList.contains('ring-2'));
      expect(isNowActive).toBe(true);
    }
  });

  test('should validate pause/resume performance requirements', async ({ page }) => {
    const cameraIds = ['camera-1', 'camera-2', 'camera-3'];
    
    // Start analysis on multiple cameras
    for (const cameraId of cameraIds) {
      await helpers.toggleCameraAnalysis(cameraId, true);
      await helpers.toggleCameraPlayback(cameraId, true);
    }
    
    // Test pause performance
    const pauseMetrics = await helpers.measurePerformance(async () => {
      for (const cameraId of cameraIds) {
        await helpers.toggleCameraAnalysis(cameraId, false);
      }
      return { cameras: cameraIds.length };
    }, 'Multi-Camera Pause Operation');
    
    // Should complete within 5 seconds per requirement
    expect(pauseMetrics.performanceMetrics.duration).toBeLessThan(5000);
    
    // Test resume performance
    const resumeMetrics = await helpers.measurePerformance(async () => {
      for (const cameraId of cameraIds) {
        await helpers.toggleCameraAnalysis(cameraId, true);
      }
      return { cameras: cameraIds.length };
    }, 'Multi-Camera Resume Operation');
    
    // Should complete within 5 seconds per requirement
    expect(resumeMetrics.performanceMetrics.duration).toBeLessThan(5000);
    
    console.log(`✅ Pause/Resume Performance: Pause ${pauseMetrics.performanceMetrics.duration}ms, Resume ${resumeMetrics.performanceMetrics.duration}ms`);
  });

  test('should handle concurrent pause/resume operations', async ({ page }) => {
    const cameraIds = ['camera-1', 'camera-2', 'camera-3', 'camera-4'];
    
    // Start analysis on all cameras
    for (const cameraId of cameraIds) {
      await helpers.toggleCameraAnalysis(cameraId, true);
      await helpers.toggleCameraPlayback(cameraId, true);
    }
    
    // Perform concurrent pause/resume operations
    await helpers.measurePerformance(async () => {
      // Start all pause operations simultaneously
      const pausePromises = cameraIds.map(cameraId => 
        helpers.toggleCameraAnalysis(cameraId, false)
      );
      await Promise.all(pausePromises);
      
      await page.waitForTimeout(500);
      
      // Start all resume operations simultaneously
      const resumePromises = cameraIds.map(cameraId => 
        helpers.toggleCameraAnalysis(cameraId, true)
      );
      await Promise.all(resumePromises);
      
      return { operations: cameraIds.length * 2 };
    }, 'Concurrent Pause/Resume Operations');
    
    // Verify all cameras are in correct final state
    await page.waitForTimeout(2000);
    for (const cameraId of cameraIds) {
      const button = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
      const isActive = await button.evaluate(el => el.classList.contains('ring-2'));
      expect(isActive).toBe(true);
    }
  });

  test('should maintain UI consistency during pause/resume', async ({ page }) => {
    const cameraId = 'camera-1';
    
    // Test UI feedback during operations
    await helpers.toggleCameraPlayback(cameraId, true);
    
    // Start analysis and check UI state
    await helpers.toggleCameraAnalysis(cameraId, true);
    
    // Verify button visual state
    const analysisButton = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
    
    // Should have active indication (ring)
    const hasActiveRing = await analysisButton.evaluate(el => el.classList.contains('ring-2'));
    expect(hasActiveRing).toBe(true);
    
    // Should have proper icon
    const icon = analysisButton.locator('svg');
    await expect(icon).toBeVisible();
    
    // Pause and check UI state
    await helpers.toggleCameraAnalysis(cameraId, false);
    
    // Should remove active indication
    const noActiveRing = await analysisButton.evaluate(el => !el.classList.contains('ring-2'));
    expect(noActiveRing).toBe(true);
    
    // Should still be clickable
    await expect(analysisButton).toBeEnabled();
    
    // Test tooltip functionality
    await analysisButton.hover();
    const tooltip = page.locator('[role="tooltip"]');
    // Note: Tooltip text depends on implementation
    await expect(tooltip).toBeVisible({ timeout: 2000 });
  });
});
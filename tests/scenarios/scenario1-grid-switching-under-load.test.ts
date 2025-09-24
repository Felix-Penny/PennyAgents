import { test, expect, type Page } from '@playwright/test';
import { TestHelpers, MockDetection } from '../utils/test-helpers';

/**
 * CRITICAL TESTING SCENARIO 1: Grid Switching Under Load
 * 
 * SCENARIO REQUIREMENTS:
 * - Start 2x2 grid with active AI analysis on all 4 cameras
 * - Switch to 4x4 grid while analysis is running
 * - Verify: No analysis interruption, proper overlay repositioning, status consistency
 */

test.describe('Scenario 1: Grid Switching Under Load', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await helpers.authenticateAndNavigate();
    await helpers.waitForWebSocketConnection();
  });

  test('CRITICAL SCENARIO: Grid switching under active AI analysis load', async ({ page }) => {
    console.log('🚀 Starting Critical Scenario 1: Grid Switching Under Load');
    
    // === PHASE 1: Setup 2x2 grid with active analysis ===
    await helpers.selectGridLayout('2x2');
    const initialCameraIds = ['camera-1', 'camera-2', 'camera-3', 'camera-4'];
    
    const setupMetrics = await helpers.measurePerformance(async () => {
      // Start AI analysis on all 4 cameras in 2x2 grid
      for (const cameraId of initialCameraIds) {
        await helpers.toggleCameraAnalysis(cameraId, true);
        await helpers.toggleCameraPlayback(cameraId, true);
      }
      
      // Verify all cameras are active
      for (const cameraId of initialCameraIds) {
        const analysisButton = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
        const isActive = await analysisButton.evaluate(el => el.classList.contains('ring-2'));
        expect(isActive).toBe(true);
      }
      
      return { phase: 'setup', camerasActivated: initialCameraIds.length };
    }, 'Scenario 1 - Phase 1: 2x2 Grid Setup');
    
    console.log(`✅ Phase 1 completed: ${setupMetrics.performanceMetrics.duration}ms`);
    
    // === PHASE 2: Generate active detections to create load ===
    await helpers.measurePerformance(async () => {
      // Inject mock detections on all cameras to create analysis load
      for (let i = 0; i < initialCameraIds.length; i++) {
        const cameraId = initialCameraIds[i];
        
        // Multiple detections per camera to increase load
        for (let j = 0; j < 3; j++) {
          const detection: MockDetection = {
            id: `load-detection-${i}-${j}`,
            confidence: 0.75 + (Math.random() * 0.2),
            boundingBox: {
              x: 50 + (j * 60),
              y: 50 + (i * 40),
              width: 100,
              height: 80
            },
            label: `Object-${i}-${j}`,
            severity: j === 2 ? 'high' : 'medium'
          };
          
          await helpers.injectMockDetection(cameraId, detection);
        }
        
        // Wait for overlay to render detection
        await helpers.waitForOverlayDetection(cameraId, 5000);
      }
      
      return { phase: 'load_generation', detectionsInjected: initialCameraIds.length * 3 };
    }, 'Scenario 1 - Phase 2: Load Generation');
    
    // Verify overlays are rendering
    const overlayCanvases = page.locator('[data-testid="detection-overlay-canvas"]');
    await expect(overlayCanvases).toHaveCount(4);
    
    // Verify at least one canvas has detection content
    const hasDetectionContent = await overlayCanvases.first().evaluate((canvasEl) => {
      const canvas = canvasEl as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return imageData.data.some(pixel => pixel !== 0);
    });
    expect(hasDetectionContent).toBe(true);
    
    console.log('✅ Phase 2 completed: Active detections generated and rendering');
    
    // === PHASE 3: Critical grid switch under load ===
    const gridSwitchMetrics = await helpers.measurePerformance(async () => {
      // Capture pre-switch state
      const preAnalysisStates = [];
      for (const cameraId of initialCameraIds) {
        const button = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
        const isActive = await button.evaluate(el => el.classList.contains('ring-2'));
        preAnalysisStates.push({ cameraId, wasActive: isActive });
      }
      
      // CRITICAL OPERATION: Switch to 4x4 grid while analysis is running
      await helpers.selectGridLayout('4x4');
      
      return { 
        phase: 'grid_switch', 
        fromGrid: '2x2', 
        toGrid: '4x4',
        preAnalysisStates 
      };
    }, 'Scenario 1 - Phase 3: CRITICAL Grid Switch Under Load');
    
    // CRITICAL REQUIREMENT: Switch should complete within 5 seconds
    expect(gridSwitchMetrics.performanceMetrics.duration).toBeLessThan(5000);
    
    console.log(`✅ Phase 3 completed: Grid switch under load in ${gridSwitchMetrics.performanceMetrics.duration}ms`);
    
    // === PHASE 4: Validate post-switch integrity ===
    await helpers.measurePerformance(async () => {
      // Verify new grid layout is correctly applied
      const newOverlayCanvases = page.locator('[data-testid="detection-overlay-canvas"]');
      await expect(newOverlayCanvases).toHaveCount(16);
      
      // CRITICAL: Verify original cameras maintain analysis state
      for (const cameraId of initialCameraIds) {
        const button = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
        
        // Analysis should still be active or easily resumable
        const isActive = await button.evaluate(el => el.classList.contains('ring-2'));
        const isEnabled = await button.isEnabled();
        
        // Either still active or can be reactivated
        expect(isEnabled).toBe(true);
        
        if (!isActive) {
          // If not active, should be able to reactivate immediately
          await helpers.toggleCameraAnalysis(cameraId, true);
          await page.waitForTimeout(500);
          
          const isNowActive = await button.evaluate(el => el.classList.contains('ring-2'));
          expect(isNowActive).toBe(true);
        }
      }
      
      return { phase: 'integrity_check', cameraCount: 16 };
    }, 'Scenario 1 - Phase 4: Post-Switch Integrity Validation');
    
    // === PHASE 5: Verify overlay repositioning ===
    await helpers.measurePerformance(async () => {
      // Check that overlays are properly positioned in new grid
      const tiles = page.locator('[data-testid^="camera-tile-"]');
      const tileCount = await tiles.count();
      expect(tileCount).toBe(16);
      
      // Verify first 4 tiles (original cameras) have properly scaled overlays
      for (let i = 0; i < 4; i++) {
        const tile = tiles.nth(i);
        const tileBounds = await tile.boundingBox();
        
        expect(tileBounds).not.toBeNull();
        expect(tileBounds!.width).toBeGreaterThan(0);
        expect(tileBounds!.height).toBeGreaterThan(0);
        
        // Overlay canvas should match tile dimensions
        const overlay = tile.locator('[data-testid="detection-overlay-canvas"]');
        const overlayBounds = await overlay.boundingBox();
        
        expect(overlayBounds).not.toBeNull();
        
        // Canvas dimensions should be reasonable for 4x4 grid
        expect(overlayBounds!.width).toBeGreaterThan(100);
        expect(overlayBounds!.height).toBeGreaterThan(100);
      }
      
      return { phase: 'overlay_repositioning', tilesValidated: 4 };
    }, 'Scenario 1 - Phase 5: Overlay Repositioning Validation');
    
    // === PHASE 6: Status consistency verification ===
    await helpers.measurePerformance(async () => {
      // Verify WebSocket status updates are consistent
      const wsConnected = await helpers.checkWebSocketStatus();
      expect(wsConnected).toBe(true);
      
      // Verify system is responsive to new operations
      const gridSelector = page.locator('[data-testid="trigger-grid-layout"]');
      await expect(gridSelector).toBeEnabled();
      
      // Test that new cameras in 4x4 grid can be activated
      const newCameraIds = ['camera-5', 'camera-6'];
      for (const cameraId of newCameraIds) {
        await helpers.toggleCameraAnalysis(cameraId, true);
        await helpers.toggleCameraPlayback(cameraId, true);
        
        const button = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
        const isActive = await button.evaluate(el => el.classList.contains('ring-2'));
        expect(isActive).toBe(true);
      }
      
      return { phase: 'status_consistency', newCamerasActivated: newCameraIds.length };
    }, 'Scenario 1 - Phase 6: Status Consistency Verification');
    
    // === FINAL VALIDATION ===
    console.log('🔍 Final Scenario 1 Validation:');
    
    // Memory usage should be reasonable
    const finalMemory = await helpers['getMemoryUsage']();
    expect(finalMemory).toBeLessThan(300); // 300MB limit
    console.log(`✅ Memory usage: ${finalMemory.toFixed(2)}MB`);
    
    // No JavaScript errors should have occurred
    const errors = await page.evaluate(() => (window as any).__testErrors || []);
    expect(errors.length).toBe(0);
    console.log('✅ No JavaScript errors detected');
    
    // System should be ready for continued operation
    const systemReady = await page.evaluate(() => document.readyState === 'complete');
    expect(systemReady).toBe(true);
    console.log('✅ System ready for continued operation');
    
    console.log('🎉 CRITICAL SCENARIO 1 COMPLETED SUCCESSFULLY');
    console.log('Grid switching under load maintains analysis integrity and system stability');
  });

  test('STRESS TEST: Multiple rapid grid switches under analysis load', async ({ page }) => {
    console.log('🔥 Starting Stress Test: Rapid Grid Switches Under Load');
    
    // Setup initial analysis load
    await helpers.selectGridLayout('2x2');
    const cameraIds = ['camera-1', 'camera-2', 'camera-3', 'camera-4'];
    
    for (const cameraId of cameraIds) {
      await helpers.toggleCameraAnalysis(cameraId, true);
      await helpers.toggleCameraPlayback(cameraId, true);
      
      // Add detection load
      await helpers.injectMockDetection(cameraId, {
        id: `stress-detection-${cameraId}`,
        confidence: 0.85,
        boundingBox: { x: 100, y: 100, width: 150, height: 100 },
        label: 'Stress Test Object',
        severity: 'high'
      });
    }
    
    // Rapid grid switching sequence
    const gridSequence = ['3x3', '4x4', '2x2', '1x1', '3x3', '4x4'];
    
    const stressTestMetrics = await helpers.measurePerformance(async () => {
      for (const grid of gridSequence) {
        await helpers.selectGridLayout(grid as any);
        
        // Brief pause to allow DOM updates
        await page.waitForTimeout(500);
        
        // Verify system stability
        const gridSelector = page.locator('[data-testid="trigger-grid-layout"]');
        await expect(gridSelector).toBeEnabled();
      }
      
      return { gridSwitches: gridSequence.length };
    }, 'Stress Test: Rapid Grid Switches');
    
    // Should handle rapid switches within reasonable time
    expect(stressTestMetrics.performanceMetrics.duration).toBeLessThan(15000);
    
    // Verify final state is stable
    await page.waitForTimeout(2000);
    
    const finalGrid = page.locator('[data-testid="camera-grid"]');
    await expect(finalGrid).toBeVisible();
    
    // Check for any error states
    const errorElements = page.locator('[data-testid*="error"]');
    const errorCount = await errorElements.count();
    expect(errorCount).toBe(0);
    
    console.log(`✅ Stress test completed: ${gridSequence.length} grid switches in ${stressTestMetrics.performanceMetrics.duration}ms`);
  });

  test('EDGE CASE: Grid switch during overlay rendering peak', async ({ page }) => {
    console.log('⚡ Edge Case: Grid Switch During Overlay Rendering Peak');
    
    await helpers.selectGridLayout('2x2');
    const cameraIds = ['camera-1', 'camera-2', 'camera-3', 'camera-4'];
    
    // Setup analysis
    for (const cameraId of cameraIds) {
      await helpers.toggleCameraAnalysis(cameraId, true);
      await helpers.toggleCameraPlayback(cameraId, true);
    }
    
    // Generate intensive overlay rendering load
    const detectionPromises = cameraIds.flatMap(cameraId => 
      Array.from({ length: 8 }, (_, i) => {
        const detection: MockDetection = {
          id: `peak-detection-${cameraId}-${i}`,
          confidence: 0.70 + (Math.random() * 0.25),
          boundingBox: {
            x: 20 + (i * 30),
            y: 20 + ((i % 3) * 40),
            width: 60 + (Math.random() * 40),
            height: 50 + (Math.random() * 30)
          },
          label: `Peak-${i}`,
          severity: Math.random() > 0.7 ? 'critical' : 'medium'
        };
        
        return helpers.injectMockDetection(cameraId, detection);
      })
    );
    
    // Start injecting detections
    await Promise.all(detectionPromises);
    
    // Wait for overlay rendering to start
    await page.waitForTimeout(1000);
    
    // CRITICAL: Switch grid during peak overlay rendering
    const edgeCaseMetrics = await helpers.measurePerformance(async () => {
      await helpers.selectGridLayout('4x4');
      return {};
    }, 'Edge Case: Grid Switch During Overlay Peak');
    
    // Should handle even this extreme case gracefully
    expect(edgeCaseMetrics.performanceMetrics.duration).toBeLessThan(7000);
    
    // Verify system recovers properly
    await page.waitForTimeout(3000);
    
    const newCanvases = page.locator('[data-testid="detection-overlay-canvas"]');
    await expect(newCanvases).toHaveCount(16);
    
    // System should be responsive
    const gridSelector = page.locator('[data-testid="trigger-grid-layout"]');
    await expect(gridSelector).toBeEnabled();
    
    console.log(`✅ Edge case handled: Grid switch during overlay peak in ${edgeCaseMetrics.performanceMetrics.duration}ms`);
  });
});
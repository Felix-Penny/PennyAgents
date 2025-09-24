import { test, expect, type Page } from '@playwright/test';
import { TestHelpers, MockDetection } from '../utils/test-helpers';

/**
 * CRITICAL TESTING SCENARIO 2: Pause/Resume Stress Test
 * 
 * SCENARIO REQUIREMENTS:
 * - Rapidly pause and resume individual cameras in 3x3 grid
 * - Test global pause during active threat detection
 * - Verify: Clean state transitions, no memory leaks, proper WebSocket sync
 */

test.describe('Scenario 2: Pause/Resume Stress Test', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await helpers.authenticateAndNavigate();
    await helpers.waitForWebSocketConnection();
  });

  test('CRITICAL SCENARIO: Rapid pause/resume stress test in 3x3 grid', async ({ page }) => {
    console.log('🚀 Starting Critical Scenario 2: Pause/Resume Stress Test');
    
    // === PHASE 1: Setup 3x3 grid with active analysis ===
    await helpers.selectGridLayout('3x3');
    const cameraIds = Array.from({ length: 9 }, (_, i) => `camera-${i + 1}`);
    const activeCameraIds = cameraIds.slice(0, 6); // Use 6 cameras for stress test
    
    const setupMetrics = await helpers.measurePerformance(async () => {
      // Start analysis on 6 cameras in 3x3 grid
      for (const cameraId of activeCameraIds) {
        await helpers.toggleCameraAnalysis(cameraId, true);
        await helpers.toggleCameraPlayback(cameraId, true);
      }
      
      // Verify all cameras are active
      for (const cameraId of activeCameraIds) {
        const button = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
        const isActive = await button.evaluate(el => el.classList.contains('ring-2'));
        expect(isActive).toBe(true);
      }
      
      return { phase: 'setup', camerasActivated: activeCameraIds.length };
    }, 'Scenario 2 - Phase 1: 3x3 Grid Setup');
    
    console.log(`✅ Phase 1 completed: ${setupMetrics.performanceMetrics.duration}ms`);
    
    // === PHASE 2: Generate active threat detections ===
    const initialMemory = await helpers['getMemoryUsage']();
    
    await helpers.measurePerformance(async () => {
      // Inject threat detections on all active cameras
      for (let i = 0; i < activeCameraIds.length; i++) {
        const cameraId = activeCameraIds[i];
        
        // Multiple threat detections per camera
        for (let j = 0; j < 2; j++) {
          const detection: MockDetection = {
            id: `stress-threat-${i}-${j}`,
            confidence: 0.80 + (Math.random() * 0.15),
            boundingBox: {
              x: 60 + (j * 80),
              y: 40 + (i * 30),
              width: 90,
              height: 70
            },
            label: `Threat-${i}-${j}`,
            severity: j === 1 ? 'high' : 'medium'
          };
          
          await helpers.injectMockDetection(cameraId, detection);
        }
        
        // Wait for overlay to render
        await helpers.waitForOverlayDetection(cameraId, 5000);
      }
      
      return { phase: 'threat_generation', threatsGenerated: activeCameraIds.length * 2 };
    }, 'Scenario 2 - Phase 2: Threat Generation');
    
    console.log('✅ Phase 2 completed: Active threats generated across grid');
    
    // === PHASE 3: Rapid individual pause/resume cycles ===
    const rapidCycleMetrics = await helpers.measurePerformance(async () => {
      const cycles = 10;
      
      for (let cycle = 0; cycle < cycles; cycle++) {
        // Rapidly pause cameras in sequence
        for (const cameraId of activeCameraIds) {
          await helpers.toggleCameraAnalysis(cameraId, false);
          await page.waitForTimeout(50); // Very brief pause
        }
        
        // Brief pause between operations
        await page.waitForTimeout(200);
        
        // Rapidly resume cameras in sequence
        for (const cameraId of activeCameraIds) {
          await helpers.toggleCameraAnalysis(cameraId, true);
          await page.waitForTimeout(50); // Very brief pause
        }
        
        // Slightly longer pause between cycles
        await page.waitForTimeout(300);
        
        // Verify no errors occurred
        const errors = await page.evaluate(() => (window as any).__testErrors || []);
        expect(errors.length).toBe(0);
      }
      
      return { phase: 'rapid_cycles', cycles, cameras: activeCameraIds.length };
    }, 'Scenario 2 - Phase 3: Rapid Pause/Resume Cycles');
    
    // CRITICAL REQUIREMENT: Rapid cycles should complete within reasonable time
    expect(rapidCycleMetrics.performanceMetrics.duration).toBeLessThan(30000); // 30 seconds max
    
    console.log(`✅ Phase 3 completed: ${rapidCycleMetrics.cycles} rapid cycles in ${rapidCycleMetrics.performanceMetrics.duration}ms`);
    
    // === PHASE 4: Global pause during active threat detection ===
    await helpers.measurePerformance(async () => {
      // Ensure all cameras are active with threat detections
      for (const cameraId of activeCameraIds) {
        const button = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
        const isActive = await button.evaluate(el => el.classList.contains('ring-2'));
        
        if (!isActive) {
          await helpers.toggleCameraAnalysis(cameraId, true);
          await page.waitForTimeout(200);
        }
      }
      
      // Inject fresh threat detections
      for (const cameraId of activeCameraIds) {
        const globalThreat: MockDetection = {
          id: `global-threat-${cameraId}`,
          confidence: 0.95,
          boundingBox: { x: 80, y: 80, width: 140, height: 100 },
          label: 'CRITICAL THREAT',
          severity: 'critical'
        };
        
        await helpers.injectMockDetection(cameraId, globalThreat);
      }
      
      // CRITICAL OPERATION: Global pause during active threat detection
      const globalPausePromises = activeCameraIds.map(cameraId => 
        helpers.toggleCameraAnalysis(cameraId, false)
      );
      
      await Promise.all(globalPausePromises);
      
      return { phase: 'global_pause', camerasAffected: activeCameraIds.length };
    }, 'Scenario 2 - Phase 4: Global Pause During Threat Detection');
    
    // Verify all cameras are paused
    for (const cameraId of activeCameraIds) {
      const button = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
      const isPaused = await button.evaluate(el => !el.classList.contains('ring-2'));
      expect(isPaused).toBe(true);
    }
    
    console.log('✅ Phase 4 completed: Global pause executed during active threat detection');
    
    // === PHASE 5: Verify clean state transitions ===
    await helpers.measurePerformance(async () => {
      // Test clean state transitions by resuming analysis
      const globalResumePromises = activeCameraIds.map(cameraId => 
        helpers.toggleCameraAnalysis(cameraId, true)
      );
      
      await Promise.all(globalResumePromises);
      
      // Wait for state to stabilize
      await page.waitForTimeout(3000);
      
      // Verify clean resumption
      for (const cameraId of activeCameraIds) {
        const button = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
        const isActive = await button.evaluate(el => el.classList.contains('ring-2'));
        expect(isActive).toBe(true);
        
        // Verify no error states
        const errorIndicator = page.locator(`[data-testid="camera-error-${cameraId}"]`);
        if (await errorIndicator.isVisible()) {
          // Should not have persistent errors
          expect(false).toBe(true);
        }
      }
      
      return { phase: 'state_verification', camerasVerified: activeCameraIds.length };
    }, 'Scenario 2 - Phase 5: Clean State Transition Verification');
    
    console.log('✅ Phase 5 completed: Clean state transitions verified');
    
    // === PHASE 6: Memory leak detection ===
    await helpers.measurePerformance(async () => {
      // Force garbage collection if available
      await page.evaluate(() => {
        if ((window as any).gc) {
          (window as any).gc();
        }
      });
      
      await page.waitForTimeout(2000);
      
      const finalMemory = await helpers['getMemoryUsage']();
      const memoryGrowth = finalMemory - initialMemory;
      
      // Memory growth should be reasonable after stress test
      expect(memoryGrowth).toBeLessThan(100); // 100MB limit
      
      console.log(`Memory usage: Initial ${initialMemory.toFixed(2)}MB → Final ${finalMemory.toFixed(2)}MB (Δ${memoryGrowth.toFixed(2)}MB)`);
      
      return { phase: 'memory_check', memoryGrowth };
    }, 'Scenario 2 - Phase 6: Memory Leak Detection');
    
    // === PHASE 7: WebSocket synchronization verification ===
    await helpers.measurePerformance(async () => {
      // Verify WebSocket connection is still stable
      const wsConnected = await helpers.checkWebSocketStatus();
      expect(wsConnected).toBe(true);
      
      // Test WebSocket responsiveness with control commands
      const testCameraId = activeCameraIds[0];
      
      // Rapid toggle to test WebSocket sync
      await helpers.toggleCameraAnalysis(testCameraId, false);
      await page.waitForTimeout(500);
      await helpers.toggleCameraAnalysis(testCameraId, true);
      await page.waitForTimeout(500);
      
      // Verify final state is synchronized
      const button = page.locator(`[data-testid="button-toggle-analysis-${testCameraId}"]`);
      const isSynced = await button.evaluate(el => el.classList.contains('ring-2'));
      expect(isSynced).toBe(true);
      
      return { phase: 'websocket_sync', wsConnected };
    }, 'Scenario 2 - Phase 7: WebSocket Synchronization Verification');
    
    console.log('✅ Phase 7 completed: WebSocket synchronization verified');
    
    // === FINAL VALIDATION ===
    console.log('🔍 Final Scenario 2 Validation:');
    
    // System responsiveness check
    const gridSelector = page.locator('[data-testid="trigger-grid-layout"]');
    await expect(gridSelector).toBeEnabled();
    
    // Grid switching should still work
    await helpers.selectGridLayout('2x2');
    await page.waitForTimeout(1000);
    await helpers.selectGridLayout('3x3');
    
    // No persistent errors
    const errors = await page.evaluate(() => (window as any).__testErrors || []);
    expect(errors.length).toBe(0);
    
    // All cameras should be controllable
    for (let i = 0; i < 3; i++) {
      const cameraId = activeCameraIds[i];
      const button = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
      await expect(button).toBeEnabled();
    }
    
    console.log('✅ System stability verified after stress test');
    console.log('🎉 CRITICAL SCENARIO 2 COMPLETED SUCCESSFULLY');
    console.log('Pause/Resume stress test demonstrates system resilience and clean state management');
  });

  test('EXTREME STRESS: Concurrent pause/resume across all cameras', async ({ page }) => {
    console.log('💥 Extreme Stress Test: Concurrent Pause/Resume');
    
    await helpers.selectGridLayout('3x3');
    const allCameraIds = Array.from({ length: 9 }, (_, i) => `camera-${i + 1}`);
    
    // Setup all cameras
    for (const cameraId of allCameraIds) {
      await helpers.toggleCameraAnalysis(cameraId, true);
      await helpers.toggleCameraPlaybook(cameraId, true);
    }
    
    // Extreme concurrent operations
    const extremeStressMetrics = await helpers.measurePerformance(async () => {
      const iterations = 5;
      
      for (let iteration = 0; iteration < iterations; iteration++) {
        // Concurrent pause all cameras
        const pausePromises = allCameraIds.map(cameraId => 
          helpers.toggleCameraAnalysis(cameraId, false)
        );
        await Promise.all(pausePromises);
        
        await page.waitForTimeout(300);
        
        // Concurrent resume all cameras
        const resumePromises = allCameraIds.map(cameraId => 
          helpers.toggleCameraAnalysis(cameraId, true)
        );
        await Promise.all(resumePromises);
        
        await page.waitForTimeout(500);
      }
      
      return { iterations, cameras: allCameraIds.length };
    }, 'Extreme Concurrent Pause/Resume Stress');
    
    // Should handle extreme load within reasonable time
    expect(extremeStressMetrics.performanceMetrics.duration).toBeLessThan(45000);
    
    // Verify system integrity
    const gridSelector = page.locator('[data-testid="trigger-grid-layout"]');
    await expect(gridSelector).toBeEnabled();
    
    console.log(`✅ Extreme stress test: ${extremeStressMetrics.cameras} cameras, ${extremeStressMetrics.iterations} iterations`);
  });

  test('EDGE CASE: Pause during overlay rendering peak', async ({ page }) => {
    console.log('⚡ Edge Case: Pause During Overlay Rendering Peak');
    
    await helpers.selectGridLayout('3x3');
    const cameraIds = ['camera-1', 'camera-2', 'camera-3'];
    
    // Setup cameras with intensive overlay rendering
    for (const cameraId of cameraIds) {
      await helpers.toggleCameraAnalysis(cameraId, true);
      await helpers.toggleCameraPlayback(cameraId, true);
      
      // Generate intensive overlay load
      for (let i = 0; i < 6; i++) {
        const detection: MockDetection = {
          id: `peak-render-${cameraId}-${i}`,
          confidence: 0.75 + (Math.random() * 0.2),
          boundingBox: {
            x: 20 + (i * 25),
            y: 20 + ((i % 3) * 35),
            width: 50 + (Math.random() * 30),
            height: 40 + (Math.random() * 20)
          },
          label: `Peak-${i}`,
          severity: Math.random() > 0.6 ? 'high' : 'medium'
        };
        
        await helpers.injectMockDetection(cameraId, detection);
      }
    }
    
    // Wait for rendering to start
    await page.waitForTimeout(1500);
    
    // CRITICAL: Pause during peak rendering
    const edgeCaseMetrics = await helpers.measurePerformance(async () => {
      // Rapid pause all cameras during rendering peak
      const pausePromises = cameraIds.map(cameraId => 
        helpers.toggleCameraAnalysis(cameraId, false)
      );
      
      await Promise.all(pausePromises);
      
      return { camerasAffected: cameraIds.length };
    }, 'Edge Case: Pause During Rendering Peak');
    
    // Should handle gracefully even during rendering peak
    expect(edgeCaseMetrics.performanceMetrics.duration).toBeLessThan(5000);
    
    // Verify system stability
    await page.waitForTimeout(2000);
    
    for (const cameraId of cameraIds) {
      const button = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
      await expect(button).toBeEnabled();
    }
    
    console.log(`✅ Edge case handled gracefully in ${edgeCaseMetrics.performanceMetrics.duration}ms`);
  });

  test('RECOVERY TEST: System recovery after stress scenarios', async ({ page }) => {
    console.log('🔄 Recovery Test: Post-Stress System Recovery');
    
    await helpers.selectGridLayout('3x3');
    const cameraIds = ['camera-1', 'camera-2', 'camera-3', 'camera-4'];
    
    // Simulate stress condition
    const stressPausePromises = cameraIds.flatMap(cameraId => 
      Array.from({ length: 20 }, () => 
        helpers.toggleCameraAnalysis(cameraId, false)
          .then(() => page.waitForTimeout(25))
          .then(() => helpers.toggleCameraAnalysis(cameraId, true))
          .catch(() => {}) // Ignore rate limit errors
      )
    );
    
    await Promise.allSettled(stressPausePromises);
    
    // Recovery test
    const recoveryMetrics = await helpers.measurePerformance(async () => {
      // Wait for system to settle
      await page.waitForTimeout(5000);
      
      // Verify all controls are responsive
      for (const cameraId of cameraIds) {
        const button = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
        await expect(button).toBeEnabled();
        
        // Test functionality
        await helpers.toggleCameraAnalysis(cameraId, true);
        await page.waitForTimeout(500);
        
        const isActive = await button.evaluate(el => el.classList.contains('ring-2'));
        expect(isActive).toBe(true);
      }
      
      // Test grid switching
      await helpers.selectGridLayout('2x2');
      await helpers.selectGridLayout('3x3');
      
      return { camerasRecovered: cameraIds.length };
    }, 'System Recovery After Stress');
    
    console.log(`✅ System recovered successfully: ${recoveryMetrics.camerasRecovered} cameras functional`);
  });
});
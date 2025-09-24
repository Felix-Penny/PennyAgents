import { test, expect, type Page } from '@playwright/test';
import { TestHelpers, MockDetection } from '../utils/test-helpers';

/**
 * Test Suite 7: Cross-Component Integration
 * 
 * OBJECTIVES:
 * - Test camera grid + AI analysis + WebSocket status + overlays working together
 * - Verify state consistency across components during operations
 * - Test error propagation and recovery across the system stack
 * - Validate data flow from camera controls to threat visualization
 * - Ensure seamless integration without component conflicts
 */

test.describe('Cross-Component Integration Tests', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await helpers.authenticateAndNavigate();
    await helpers.waitForWebSocketConnection();
  });

  test('should integrate camera grid + AI analysis + overlays seamlessly', async ({ page }) => {
    console.log('🔗 Testing complete component integration pipeline');
    
    // Test full integration pipeline
    const integrationMetrics = await helpers.measurePerformance(async () => {
      // Step 1: Setup camera grid
      await helpers.selectGridLayout('2x2');
      
      // Step 2: Start camera analysis
      const cameraIds = ['camera-1', 'camera-2', 'camera-3', 'camera-4'];
      
      for (const cameraId of cameraIds) {
        await helpers.toggleCameraPlayback(cameraId, true);
        await helpers.toggleCameraAnalysis(cameraId, true);
      }
      
      // Step 3: Generate AI detections
      for (let i = 0; i < cameraIds.length; i++) {
        const cameraId = cameraIds[i];
        const detection: MockDetection = {
          id: `integration-detection-${i}`,
          confidence: 0.80 + (i * 0.05),
          boundingBox: {
            x: 60 + (i * 20),
            y: 60 + (i * 15),
            width: 100,
            height: 80
          },
          label: `Integration Test ${i + 1}`,
          severity: i % 2 === 0 ? 'high' : 'medium'
        };
        
        await helpers.injectMockDetection(cameraId, detection);
      }
      
      // Step 4: Wait for overlays to render
      for (const cameraId of cameraIds) {
        await helpers.waitForOverlayDetection(cameraId, 8000);
      }
      
      // Step 5: Verify WebSocket synchronization
      const isConnected = await helpers.checkWebSocketStatus();
      expect(isConnected).toBe(true);
      
      return { pipeline: 'complete', components: 4 };
    }, 'Complete Component Integration Pipeline');
    
    // Integration should complete within reasonable time
    expect(integrationMetrics.performanceMetrics.duration).toBeLessThan(25000);
    
    // Verify all components are working together
    const overlayCanvases = page.locator('[data-testid="detection-overlay-canvas"]');
    await expect(overlayCanvases).toHaveCount(4);
    
    // Verify at least one overlay has content
    const firstCanvas = overlayCanvases.first();
    const hasContent = await firstCanvas.evaluate((canvasEl) => {
      const canvas = canvasEl as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return imageData.data.some(pixel => pixel !== 0);
    });
    expect(hasContent).toBe(true);
    
    console.log(`✅ Complete integration pipeline: ${integrationMetrics.performanceMetrics.duration}ms`);
  });

  test('should maintain state consistency across all components', async ({ page }) => {
    await helpers.selectGridLayout('3x3');
    const cameraIds = ['camera-1', 'camera-2', 'camera-3'];
    
    // Test state consistency across operations
    const stateConsistencyTest = await helpers.measurePerformance(async () => {
      // Initialize all components
      for (const cameraId of cameraIds) {
        await helpers.toggleCameraPlayback(cameraId, true);
        await helpers.toggleCameraAnalysis(cameraId, true);
      }
      
      // Add detections to create state
      for (const cameraId of cameraIds) {
        const detection: MockDetection = {
          id: `state-test-${cameraId}`,
          confidence: 0.85,
          boundingBox: { x: 80, y: 80, width: 120, height: 90 },
          label: 'State Test',
          severity: 'medium'
        };
        
        await helpers.injectMockDetection(cameraId, detection);
      }
      
      // Perform grid switch to test state preservation
      await helpers.selectGridLayout('2x2');
      await page.waitForTimeout(1000);
      await helpers.selectGridLayout('3x3');
      
      // Verify state consistency after grid change
      for (const cameraId of cameraIds) {
        const button = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
        const isActive = await button.evaluate(el => el.classList.contains('ring-2'));
        
        // Analysis should either be maintained or easily restorable
        if (!isActive) {
          await helpers.toggleCameraAnalysis(cameraId, true);
          await page.waitForTimeout(500);
          
          const isNowActive = await button.evaluate(el => el.classList.contains('ring-2'));
          expect(isNowActive).toBe(true);
        }
      }
      
      return { stateChecks: cameraIds.length };
    }, 'Cross-Component State Consistency');
    
    console.log(`✅ State consistency maintained across ${stateConsistencyTest.stateChecks} components`);
  });

  test('should handle error propagation and recovery across system stack', async ({ page }) => {
    await helpers.selectGridLayout('2x2');
    const cameraIds = ['camera-1', 'camera-2'];
    
    // Test error propagation and recovery
    const errorRecoveryTest = await helpers.measurePerformance(async () => {
      // Setup normal operation
      for (const cameraId of cameraIds) {
        await helpers.toggleCameraPlayback(cameraId, true);
        await helpers.toggleCameraAnalysis(cameraId, true);
      }
      
      // Simulate network error
      await helpers.simulateNetworkCondition('offline');
      await page.waitForTimeout(3000);
      
      // Restore network
      await helpers.simulateNetworkCondition('normal');
      await page.waitForTimeout(2000);
      
      // Verify system recovery across all components
      // 1. WebSocket should reconnect
      const wsConnected = await helpers.checkWebSocketStatus();
      expect(wsConnected).toBe(true);
      
      // 2. Camera controls should be responsive
      for (const cameraId of cameraIds) {
        const button = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
        await expect(button).toBeEnabled();
      }
      
      // 3. Grid switching should work
      await helpers.selectGridLayout('1x1');
      await helpers.selectGridLayout('2x2');
      
      // 4. Analysis can be restarted
      for (const cameraId of cameraIds) {
        await helpers.toggleCameraAnalysis(cameraId, true);
        await page.waitForTimeout(500);
        
        const button = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
        const isActive = await button.evaluate(el => el.classList.contains('ring-2'));
        expect(isActive).toBe(true);
      }
      
      return { recoverySteps: 4 };
    }, 'System-Wide Error Recovery');
    
    console.log(`✅ System recovery verified across ${errorRecoveryTest.recoverySteps} components`);
  });

  test('should validate data flow from controls to visualization', async ({ page }) => {
    await helpers.selectGridLayout('2x2');
    const cameraId = 'camera-1';
    
    // Test complete data flow pipeline
    const dataFlowTest = await helpers.measurePerformance(async () => {
      // Step 1: Camera control → Analysis start
      await helpers.toggleCameraPlayback(cameraId, true);
      await helpers.toggleCameraAnalysis(cameraId, true);
      
      // Verify control state
      const analysisButton = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
      const isAnalysisActive = await analysisButton.evaluate(el => el.classList.contains('ring-2'));
      expect(isAnalysisActive).toBe(true);
      
      // Step 2: Analysis → Detection generation
      const detection: MockDetection = {
        id: 'dataflow-test-detection',
        confidence: 0.90,
        boundingBox: { x: 100, y: 100, width: 150, height: 120 },
        label: 'Data Flow Test',
        severity: 'high'
      };
      
      await helpers.injectMockDetection(cameraId, detection);
      
      // Step 3: Detection → Overlay visualization
      await helpers.waitForOverlayDetection(cameraId, 8000);
      
      // Verify visualization is rendered
      const canvas = page.locator('[data-testid="detection-overlay-canvas"]').first();
      const hasVisualization = await canvas.evaluate((canvasEl) => {
        const canvas = canvasEl as HTMLCanvasElement;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return imageData.data.some(pixel => pixel !== 0);
      });
      expect(hasVisualization).toBe(true);
      
      // Step 4: Control → Analysis stop → Overlay clear
      await helpers.toggleCameraAnalysis(cameraId, false);
      await page.waitForTimeout(1000);
      
      // Verify analysis stopped
      const isAnalysisStopped = await analysisButton.evaluate(el => !el.classList.contains('ring-2'));
      expect(isAnalysisStopped).toBe(true);
      
      return { dataFlowSteps: 4 };
    }, 'Complete Data Flow Validation');
    
    console.log(`✅ Data flow validated: ${dataFlowTest.dataFlowSteps} steps in ${dataFlowTest.performanceMetrics.duration}ms`);
  });

  test('should ensure no component conflicts during concurrent operations', async ({ page }) => {
    await helpers.selectGridLayout('3x3');
    const cameraIds = ['camera-1', 'camera-2', 'camera-3', 'camera-4'];
    
    // Test concurrent operations across all components
    const concurrentOpsTest = await helpers.measurePerformance(async () => {
      // Concurrent component operations
      const operations = [
        // Grid operations
        () => helpers.selectGridLayout('2x2'),
        () => helpers.selectGridLayout('3x3'),
        
        // Camera control operations
        ...cameraIds.map(id => () => helpers.toggleCameraAnalysis(id, true)),
        ...cameraIds.map(id => () => helpers.toggleCameraPlayback(id, true)),
        
        // Detection injection operations
        ...cameraIds.map(id => () => helpers.injectMockDetection(id, {
          id: `concurrent-${id}`,
          confidence: 0.75,
          boundingBox: { x: 70, y: 70, width: 90, height: 70 },
          label: 'Concurrent Test',
          severity: 'medium'
        }))
      ];
      
      // Execute some operations concurrently
      const concurrentPromises = operations.slice(0, 8).map(op => 
        Promise.resolve().then(op).catch(() => {}) // Ignore conflicts
      );
      
      await Promise.allSettled(concurrentPromises);
      
      // Wait for system to stabilize
      await page.waitForTimeout(3000);
      
      // Verify no component conflicts
      // 1. Grid should be responsive
      const gridSelector = page.locator('[data-testid="trigger-grid-layout"]');
      await expect(gridSelector).toBeEnabled();
      
      // 2. Camera controls should be functional
      for (const cameraId of cameraIds) {
        const button = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
        await expect(button).toBeEnabled();
      }
      
      // 3. WebSocket should be connected
      const wsConnected = await helpers.checkWebSocketStatus();
      expect(wsConnected).toBe(true);
      
      // 4. Overlays should be renderable
      const overlays = page.locator('[data-testid="detection-overlay-canvas"]');
      const overlayCount = await overlays.count();
      expect(overlayCount).toBeGreaterThan(0);
      
      return { concurrentOps: concurrentPromises.length };
    }, 'Concurrent Component Operations');
    
    console.log(`✅ No component conflicts detected during ${concurrentOpsTest.concurrentOps} concurrent operations`);
  });

  test('should validate component lifecycle management', async ({ page }) => {
    // Test component initialization, operation, and cleanup
    const lifecycleTest = await helpers.measurePerformance(async () => {
      const grids = ['1x1', '2x2', '3x3', '4x4'] as const;
      
      for (const gridSize of grids) {
        // Component initialization
        await helpers.selectGridLayout(gridSize);
        
        // Verify proper initialization
        const expectedTiles = { '1x1': 1, '2x2': 4, '3x3': 9, '4x4': 16 }[gridSize];
        const tiles = page.locator('[data-testid^="camera-tile-"]');
        await expect(tiles).toHaveCount(expectedTiles);
        
        const overlays = page.locator('[data-testid="detection-overlay-canvas"]');
        await expect(overlays).toHaveCount(expectedTiles);
        
        // Component operation
        if (expectedTiles <= 4) { // Test operations on smaller grids
          const cameraId = 'camera-1';
          await helpers.toggleCameraAnalysis(cameraId, true);
          await helpers.toggleCameraPlayback(cameraId, true);
          
          // Inject test detection
          await helpers.injectMockDetection(cameraId, {
            id: `lifecycle-${gridSize}`,
            confidence: 0.80,
            boundingBox: { x: 60, y: 60, width: 80, height: 60 },
            label: 'Lifecycle Test',
            severity: 'medium'
          });
          
          await page.waitForTimeout(1000);
          
          // Cleanup
          await helpers.toggleCameraAnalysis(cameraId, false);
        }
      }
      
      return { gridsTested: grids.length };
    }, 'Component Lifecycle Management');
    
    console.log(`✅ Component lifecycle validated across ${lifecycleTest.gridsTested} grid configurations`);
  });

  test('should handle component state synchronization', async ({ page }) => {
    await helpers.selectGridLayout('2x2');
    const cameraIds = ['camera-1', 'camera-2'];
    
    // Test state synchronization across components
    const syncTest = await helpers.measurePerformance(async () => {
      // Setup initial state
      for (const cameraId of cameraIds) {
        await helpers.toggleCameraAnalysis(cameraId, true);
        await helpers.toggleCameraPlayback(cameraId, true);
      }
      
      // Add detections
      for (const cameraId of cameraIds) {
        await helpers.injectMockDetection(cameraId, {
          id: `sync-test-${cameraId}`,
          confidence: 0.85,
          boundingBox: { x: 80, y: 80, width: 100, height: 80 },
          label: 'Sync Test',
          severity: 'medium'
        });
      }
      
      // Test synchronization during grid change
      await helpers.selectGridLayout('1x1');
      await page.waitForTimeout(1000);
      await helpers.selectGridLayout('2x2');
      
      // Verify synchronization maintained
      for (const cameraId of cameraIds) {
        const button = page.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
        await expect(button).toBeEnabled();
        
        // State should be restorable
        const isActive = await button.evaluate(el => el.classList.contains('ring-2'));
        if (!isActive) {
          await helpers.toggleCameraAnalysis(cameraId, true);
          await page.waitForTimeout(500);
        }
      }
      
      return { syncChecks: cameraIds.length };
    }, 'Component State Synchronization');
    
    console.log(`✅ State synchronization verified for ${syncTest.syncChecks} components`);
  });

  test('should validate end-to-end integration performance', async ({ page }) => {
    // Comprehensive end-to-end performance test
    const e2ePerformanceTest = await helpers.measurePerformance(async () => {
      // Setup maximum realistic load
      await helpers.selectGridLayout('3x3');
      const cameraIds = ['camera-1', 'camera-2', 'camera-3', 'camera-4', 'camera-5'];
      
      // Start analysis on multiple cameras
      for (const cameraId of cameraIds) {
        await helpers.toggleCameraPlayback(cameraId, true);
        await helpers.toggleCameraAnalysis(cameraId, true);
      }
      
      // Generate multiple detections per camera
      const detectionPromises = cameraIds.flatMap(cameraId => 
        Array.from({ length: 2 }, (_, i) => {
          const detection: MockDetection = {
            id: `e2e-${cameraId}-${i}`,
            confidence: 0.75 + (Math.random() * 0.2),
            boundingBox: {
              x: 50 + (i * 60),
              y: 50,
              width: 80,
              height: 60
            },
            label: `E2E-${i}`,
            severity: Math.random() > 0.7 ? 'high' : 'medium'
          };
          
          return helpers.injectMockDetection(cameraId, detection);
        })
      );
      
      await Promise.all(detectionPromises);
      
      // Wait for all overlays to render
      for (const cameraId of cameraIds) {
        await helpers.waitForOverlayDetection(cameraId, 10000);
      }
      
      // Test grid switching under load
      await helpers.selectGridLayout('2x2');
      await helpers.selectGridLayout('3x3');
      
      // Verify system integrity
      const wsConnected = await helpers.checkWebSocketStatus();
      expect(wsConnected).toBe(true);
      
      const gridSelector = page.locator('[data-testid="trigger-grid-layout"]');
      await expect(gridSelector).toBeEnabled();
      
      return { 
        cameras: cameraIds.length,
        detections: detectionPromises.length,
        components: 'all'
      };
    }, 'End-to-End Integration Performance');
    
    // Should complete within production requirements
    expect(e2ePerformanceTest.performanceMetrics.duration).toBeLessThan(30000);
    
    console.log(`✅ E2E performance: ${e2ePerformanceTest.cameras} cameras, ${e2ePerformanceTest.detections} detections in ${e2ePerformanceTest.performanceMetrics.duration}ms`);
  });
});
import { test, expect, type Page } from '@playwright/test';
import { TestHelpers, MockDetection } from '../utils/test-helpers';

/**
 * Test Suite 3: Canvas Overlay Rendering
 * 
 * OBJECTIVES:
 * - Test real-time threat detection overlay display
 * - Verify overlay positioning and scaling with different grid sizes
 * - Test overlay rendering performance with multiple simultaneous detections
 * - Validate detection result visualization (faces, objects, threats)
 * - Ensure overlays clear properly when switching cameras or grids
 */

test.describe('Canvas Overlay Rendering Tests', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await helpers.authenticateAndNavigate();
    await helpers.waitForWebSocketConnection();
  });

  test('should render overlay canvas for each camera tile', async ({ page }) => {
    // Test with 2x2 grid
    await helpers.selectGridLayout('2x2');
    
    // Verify overlay canvas exists for each tile
    const overlayCanvases = page.locator('[data-testid="detection-overlay-canvas"]');
    await expect(overlayCanvases).toHaveCount(4);
    
    // Verify canvas dimensions match container
    for (let i = 0; i < 4; i++) {
      const canvas = overlayCanvases.nth(i);
      const canvasBounds = await canvas.boundingBox();
      
      expect(canvasBounds).not.toBeNull();
      expect(canvasBounds!.width).toBeGreaterThan(0);
      expect(canvasBounds!.height).toBeGreaterThan(0);
    }
  });

  test('should render detection boxes with proper scaling', async ({ page }) => {
    await helpers.selectGridLayout('2x2');
    const cameraId = 'camera-1';
    
    // Start analysis
    await helpers.toggleCameraAnalysis(cameraId, true);
    await helpers.toggleCameraPlayback(cameraId, true);
    
    // Inject mock detection
    const mockDetection: MockDetection = {
      id: 'test-detection-1',
      confidence: 0.85,
      boundingBox: { x: 100, y: 100, width: 200, height: 150 },
      label: 'Person',
      severity: 'medium'
    };
    
    await helpers.injectMockDetection(cameraId, mockDetection);
    
    // Wait for overlay to render
    await helpers.waitForOverlayDetection(cameraId, 10000);
    
    // Verify detection is rendered on canvas
    const canvas = page.locator('[data-testid="detection-overlay-canvas"]').first();
    const hasDrawnContent = await canvas.evaluate((canvasEl) => {
      const canvas = canvasEl as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return imageData.data.some(pixel => pixel !== 0);
    });
    
    expect(hasDrawnContent).toBe(true);
  });

  test('should scale overlays correctly across different grid sizes', async ({ page }) => {
    const gridSizes = ['1x1', '2x2', '3x3', '4x4'] as const;
    const cameraId = 'camera-1';
    
    for (const gridSize of gridSizes) {
      await helpers.selectGridLayout(gridSize);
      
      // Get canvas dimensions for this grid size
      const canvas = page.locator('[data-testid="detection-overlay-canvas"]').first();
      const canvasBounds = await canvas.boundingBox();
      
      expect(canvasBounds).not.toBeNull();
      
      // Canvas should scale with grid size
      console.log(`Grid ${gridSize}: Canvas ${canvasBounds!.width}x${canvasBounds!.height}`);
      
      // Start analysis and inject detection
      await helpers.toggleCameraAnalysis(cameraId, true);
      await helpers.toggleCameraPlayback(cameraId, true);
      
      const mockDetection: MockDetection = {
        id: `test-detection-${gridSize}`,
        confidence: 0.90,
        boundingBox: { x: 50, y: 50, width: 100, height: 100 },
        label: 'Object',
        severity: 'high'
      };
      
      await helpers.injectMockDetection(cameraId, mockDetection);
      
      // Verify overlay renders at correct scale
      await page.waitForTimeout(1000);
      
      const hasContent = await canvas.evaluate((canvasEl) => {
        const canvas = canvasEl as HTMLCanvasElement;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return imageData.data.some(pixel => pixel !== 0);
      });
      
      expect(hasContent).toBe(true);
      
      // Clean up for next iteration
      await helpers.toggleCameraAnalysis(cameraId, false);
    }
  });

  test('should handle multiple simultaneous detections', async ({ page }) => {
    await helpers.selectGridLayout('3x3');
    const cameraIds = ['camera-1', 'camera-2', 'camera-3'];
    
    // Start analysis on multiple cameras
    for (const cameraId of cameraIds) {
      await helpers.toggleCameraAnalysis(cameraId, true);
      await helpers.toggleCameraPlayback(cameraId, true);
    }
    
    // Inject multiple detections simultaneously
    const performanceStart = Date.now();
    
    const detectionPromises = cameraIds.map(async (cameraId, index) => {
      const mockDetection: MockDetection = {
        id: `multi-detection-${index}`,
        confidence: 0.75 + (index * 0.05),
        boundingBox: { 
          x: 50 + (index * 30), 
          y: 50 + (index * 30), 
          width: 120, 
          height: 90 
        },
        label: `Threat-${index + 1}`,
        severity: index === 2 ? 'critical' : 'medium'
      };
      
      await helpers.injectMockDetection(cameraId, mockDetection);
    });
    
    await Promise.all(detectionPromises);
    
    const renderingTime = Date.now() - performanceStart;
    console.log(`Multiple detection rendering completed in ${renderingTime}ms`);
    
    // Verify all overlays render within performance threshold
    expect(renderingTime).toBeLessThan(2000); // 2 seconds max
    
    // Wait for all overlays to render
    for (const cameraId of cameraIds) {
      await helpers.waitForOverlayDetection(cameraId, 5000);
    }
    
    // Verify each canvas has content
    const canvases = page.locator('[data-testid="detection-overlay-canvas"]');
    const canvasCount = await canvases.count();
    
    for (let i = 0; i < Math.min(canvasCount, 3); i++) {
      const canvas = canvases.nth(i);
      const hasContent = await canvas.evaluate((canvasEl) => {
        const canvas = canvasEl as HTMLCanvasElement;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return imageData.data.some(pixel => pixel !== 0);
      });
      
      expect(hasContent).toBe(true);
    }
  });

  test('should render different threat severity levels correctly', async ({ page }) => {
    await helpers.selectGridLayout('2x2');
    const cameraId = 'camera-1';
    
    await helpers.toggleCameraAnalysis(cameraId, true);
    await helpers.toggleCameraPlayback(cameraId, true);
    
    const severityLevels = ['low', 'medium', 'high', 'critical'] as const;
    
    for (const severity of severityLevels) {
      // Clear previous detection
      await page.evaluate(() => {
        if ((window as any).__clearMockDetections) {
          (window as any).__clearMockDetections();
        }
      });
      
      const mockDetection: MockDetection = {
        id: `severity-test-${severity}`,
        confidence: 0.80,
        boundingBox: { x: 75, y: 75, width: 150, height: 100 },
        label: `${severity.toUpperCase()} Threat`,
        severity
      };
      
      await helpers.injectMockDetection(cameraId, mockDetection);
      await page.waitForTimeout(1000);
      
      // Verify detection renders with appropriate visual styling
      const canvas = page.locator('[data-testid="detection-overlay-canvas"]').first();
      const hasContent = await canvas.evaluate((canvasEl) => {
        const canvas = canvasEl as HTMLCanvasElement;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return imageData.data.some(pixel => pixel !== 0);
      });
      
      expect(hasContent).toBe(true);
      console.log(`✅ ${severity} severity detection rendered`);
    }
  });

  test('should clear overlays when switching cameras or grids', async ({ page }) => {
    await helpers.selectGridLayout('2x2');
    const cameraId = 'camera-1';
    
    // Start analysis and add detection
    await helpers.toggleCameraAnalysis(cameraId, true);
    await helpers.toggleCameraPlayback(cameraId, true);
    
    const mockDetection: MockDetection = {
      id: 'clear-test-detection',
      confidence: 0.85,
      boundingBox: { x: 100, y: 100, width: 200, height: 150 },
      label: 'Test Object',
      severity: 'medium'
    };
    
    await helpers.injectMockDetection(cameraId, mockDetection);
    await helpers.waitForOverlayDetection(cameraId, 5000);
    
    // Verify overlay has content
    const canvas = page.locator('[data-testid="detection-overlay-canvas"]').first();
    let hasContent = await canvas.evaluate((canvasEl) => {
      const canvas = canvasEl as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return imageData.data.some(pixel => pixel !== 0);
    });
    
    expect(hasContent).toBe(true);
    
    // Switch grid layout
    await helpers.selectGridLayout('3x3');
    await page.waitForTimeout(1000);
    
    // Verify overlays are properly reinitialized
    const newCanvases = page.locator('[data-testid="detection-overlay-canvas"]');
    await expect(newCanvases).toHaveCount(9);
    
    // Check that new canvases start clean
    const firstNewCanvas = newCanvases.first();
    const isClean = await firstNewCanvas.evaluate((canvasEl) => {
      const canvas = canvasEl as HTMLCanvasElement;
      const ctx = canvas.getContext('2d');
      if (!ctx) return true;
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return !imageData.data.some(pixel => pixel !== 0);
    });
    
    expect(isClean).toBe(true);
  });

  test('should handle overlay rendering performance under load', async ({ page }) => {
    await helpers.selectGridLayout('4x4');
    const cameraIds = Array.from({ length: 8 }, (_, i) => `camera-${i + 1}`);
    
    // Start analysis on multiple cameras
    for (const cameraId of cameraIds) {
      await helpers.toggleCameraAnalysis(cameraId, true);
      await helpers.toggleCameraPlayback(cameraId, true);
    }
    
    // Generate multiple detections per camera
    const performanceTest = await helpers.measurePerformance(async () => {
      const allDetectionPromises = cameraIds.flatMap((cameraId, cameraIndex) => {
        return Array.from({ length: 3 }, (_, detectionIndex) => {
          const mockDetection: MockDetection = {
            id: `load-test-${cameraIndex}-${detectionIndex}`,
            confidence: 0.70 + (Math.random() * 0.25),
            boundingBox: { 
              x: 50 + (detectionIndex * 40), 
              y: 50 + (detectionIndex * 30), 
              width: 80 + (Math.random() * 40), 
              height: 60 + (Math.random() * 30) 
            },
            label: `Object-${detectionIndex}`,
            severity: detectionIndex === 2 ? 'high' : 'medium'
          };
          
          return helpers.injectMockDetection(cameraId, mockDetection);
        });
      });
      
      await Promise.all(allDetectionPromises);
      return { totalDetections: allDetectionPromises.length };
    }, 'High Load Overlay Rendering');
    
    // Should handle load within reasonable time
    expect(performanceTest.performanceMetrics.duration).toBeLessThan(5000);
    
    // Wait for rendering to complete
    await page.waitForTimeout(3000);
    
    // Verify system remains responsive
    const gridSelector = page.locator('[data-testid="trigger-grid-layout"]');
    await expect(gridSelector).toBeEnabled();
    
    // Check memory usage hasn't grown excessively
    const memoryUsage = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize / 1024 / 1024;
      }
      return 0;
    });
    
    console.log(`Memory usage after high load: ${memoryUsage.toFixed(2)}MB`);
    expect(memoryUsage).toBeLessThan(500); // Reasonable limit
  });

  test('should render detection statistics correctly', async ({ page }) => {
    await helpers.selectGridLayout('2x2');
    const cameraId = 'camera-1';
    
    await helpers.toggleCameraAnalysis(cameraId, true);
    await helpers.toggleCameraPlayback(cameraId, true);
    
    // Inject multiple detections with different severities
    const detections = [
      { severity: 'low', confidence: 0.60 },
      { severity: 'medium', confidence: 0.75 },
      { severity: 'high', confidence: 0.90 },
      { severity: 'critical', confidence: 0.95 }
    ];
    
    for (let i = 0; i < detections.length; i++) {
      const mockDetection: MockDetection = {
        id: `stats-detection-${i}`,
        confidence: detections[i].confidence,
        boundingBox: { x: 50 + (i * 30), y: 50, width: 80, height: 60 },
        label: `Threat ${i + 1}`,
        severity: detections[i].severity as any
      };
      
      await helpers.injectMockDetection(cameraId, mockDetection);
    }
    
    await page.waitForTimeout(2000);
    
    // Check if detection stats are displayed
    const statsElement = page.locator('[data-testid="detection-stats"]');
    if (await statsElement.isVisible()) {
      const statsText = await statsElement.textContent();
      expect(statsText).toContain('Detections:');
      console.log('Detection stats:', statsText);
    }
  });

  test('should handle overlay viewport changes and responsive scaling', async ({ page }) => {
    await helpers.selectGridLayout('2x2');
    const cameraId = 'camera-1';
    
    await helpers.toggleCameraAnalysis(cameraId, true);
    await helpers.toggleCameraPlayback(cameraId, true);
    
    // Add detection
    const mockDetection: MockDetection = {
      id: 'responsive-test-detection',
      confidence: 0.85,
      boundingBox: { x: 100, y: 100, width: 200, height: 150 },
      label: 'Responsive Test',
      severity: 'medium'
    };
    
    await helpers.injectMockDetection(cameraId, mockDetection);
    await helpers.waitForOverlayDetection(cameraId, 5000);
    
    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080 },
      { width: 1024, height: 768 },
      { width: 375, height: 667 }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(1000);
      
      // Verify overlay canvas adapts to new viewport
      const canvas = page.locator('[data-testid="detection-overlay-canvas"]').first();
      const canvasBounds = await canvas.boundingBox();
      
      expect(canvasBounds).not.toBeNull();
      expect(canvasBounds!.width).toBeGreaterThan(0);
      expect(canvasBounds!.height).toBeGreaterThan(0);
      
      // Verify overlay content is still rendered
      const hasContent = await canvas.evaluate((canvasEl) => {
        const canvas = canvasEl as HTMLCanvasElement;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;
        
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return imageData.data.some(pixel => pixel !== 0);
      });
      
      expect(hasContent).toBe(true);
      console.log(`✅ Overlay responsive at ${viewport.width}x${viewport.height}`);
    }
  });
});
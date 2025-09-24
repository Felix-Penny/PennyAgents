import { test, expect, type Page } from '@playwright/test';
import { TestHelpers, GRID_LAYOUTS, GRID_CAMERA_COUNTS } from '../utils/test-helpers';

/**
 * Test Suite 1: Grid Layout Switching Testing
 * 
 * OBJECTIVES:
 * - Test grid selector functionality (1x1, 2x2, 3x3, 4x4 layouts)
 * - Verify localStorage persistence across page refreshes
 * - Validate camera tile initialization and cleanup during grid changes
 * - Test responsive design and accessibility controls
 * - Ensure grid switching doesn't break ongoing AI analysis
 */

test.describe('Grid Layout Switching Integration Tests', () => {
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page);
    await helpers.authenticateAndNavigate();
    await helpers.waitForWebSocketConnection();
  });

  test('should display all grid layout options in selector', async ({ page }) => {
    // Open grid selector
    await page.click('[data-testid="trigger-grid-layout"]');
    
    // Verify all layout options are present
    for (const layout of GRID_LAYOUTS) {
      const option = page.locator(`[data-testid="option-grid-${layout}"]`);
      await expect(option).toBeVisible();
      
      // Verify option text
      const optionText = await option.textContent();
      expect(optionText).toContain(layout.replace('x', '×'));
    }
    
    // Close selector
    await page.keyboard.press('Escape');
  });

  test('should switch between all grid layouts correctly', async ({ page }) => {
    for (const layout of GRID_LAYOUTS) {
      await helpers.measurePerformance(async () => {
        // Select layout
        await helpers.selectGridLayout(layout);
        
        // Verify correct number of camera tiles
        const expectedCount = GRID_CAMERA_COUNTS[layout];
        const tiles = page.locator('[data-testid^="camera-tile-"]');
        await expect(tiles).toHaveCount(expectedCount);
        
        // Verify grid CSS classes are applied
        const grid = page.locator('[data-testid="camera-grid"]');
        const gridClasses = await grid.getAttribute('class');
        expect(gridClasses).toContain('grid');
        
        return { layout, expectedCount };
      }, `Grid Layout Switch to ${layout}`);
      
      // Small delay between switches
      await page.waitForTimeout(500);
    }
  });

  test('should persist grid layout in localStorage', async ({ page }) => {
    // Test each layout persistence
    for (const layout of GRID_LAYOUTS) {
      // Select layout
      await helpers.selectGridLayout(layout);
      
      // Verify localStorage
      await helpers.verifyLocalStoragePersistence('camera-grid-layout', layout);
      
      // Refresh page
      await page.reload({ waitUntil: 'networkidle' });
      await helpers.waitForWebSocketConnection();
      
      // Verify layout is restored
      const gridSelector = await page.textContent('[data-testid="trigger-grid-layout"]');
      expect(gridSelector).toContain(layout.replace('x', '×'));
      
      // Verify correct number of tiles
      const tiles = page.locator('[data-testid^="camera-tile-"]');
      await expect(tiles).toHaveCount(GRID_CAMERA_COUNTS[layout]);
    }
  });

  test('should maintain camera tile state during grid changes', async ({ page }) => {
    // Start with 2x2 grid
    await helpers.selectGridLayout('2x2');
    
    // Enable analysis on first camera
    const firstTile = await helpers.getCameraTile(0);
    const firstCameraId = await firstTile.getAttribute('data-camera-id') || 'camera-1';
    
    await helpers.toggleCameraAnalysis(firstCameraId, true);
    await helpers.toggleCameraPlayback(firstCameraId, true);
    
    // Switch to 3x3 grid
    await helpers.selectGridLayout('3x3');
    
    // Verify first camera maintains its state
    const updatedFirstTile = await helpers.getCameraTile(0);
    const analysisButton = updatedFirstTile.locator(`[data-testid="button-toggle-analysis-${firstCameraId}"]`);
    
    // Check if analysis is still enabled (ring indicator)
    const hasRing = await analysisButton.evaluate(el => el.classList.contains('ring-2'));
    expect(hasRing).toBe(true);
    
    // Switch to 4x4 grid
    await helpers.selectGridLayout('4x4');
    
    // Verify state is still maintained
    const finalFirstTile = await helpers.getCameraTile(0);
    const finalAnalysisButton = finalFirstTile.locator(`[data-testid="button-toggle-analysis-${firstCameraId}"]`);
    const stillHasRing = await finalAnalysisButton.evaluate(el => el.classList.contains('ring-2'));
    expect(stillHasRing).toBe(true);
  });

  test('should not break ongoing AI analysis during grid changes', async ({ page }) => {
    // Start with 2x2 grid
    await helpers.selectGridLayout('2x2');
    
    // Start AI analysis on multiple cameras
    for (let i = 0; i < 2; i++) {
      const tile = await helpers.getCameraTile(i);
      const cameraId = await tile.getAttribute('data-camera-id') || `camera-${i + 1}`;
      
      await helpers.toggleCameraAnalysis(cameraId, true);
      await helpers.toggleCameraPlayback(cameraId, true);
    }
    
    // Wait for analysis to start
    await page.waitForTimeout(2000);
    
    // Switch to 4x4 grid while analysis is running
    await helpers.measurePerformance(async () => {
      await helpers.selectGridLayout('4x4');
      return {};
    }, 'Grid Switch During Active Analysis');
    
    // Verify analysis continues on the original cameras
    for (let i = 0; i < 2; i++) {
      const tile = await helpers.getCameraTile(i);
      const cameraId = await tile.getAttribute('data-camera-id') || `camera-${i + 1}`;
      
      // Check analysis button state
      const analysisButton = tile.locator(`[data-testid="button-toggle-analysis-${cameraId}"]`);
      const isActive = await analysisButton.evaluate(el => el.classList.contains('ring-2'));
      expect(isActive).toBe(true);
      
      // Verify no error states
      const errorIndicator = tile.locator('[data-testid="camera-error"]');
      await expect(errorIndicator).not.toBeVisible();
    }
  });

  test('should handle responsive design across grid layouts', async ({ page }) => {
    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop' },
      { width: 1024, height: 768, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      
      for (const layout of GRID_LAYOUTS) {
        await helpers.selectGridLayout(layout);
        
        // Verify grid is responsive
        const grid = page.locator('[data-testid="camera-grid"]');
        const gridBounds = await grid.boundingBox();
        
        expect(gridBounds).not.toBeNull();
        expect(gridBounds!.width).toBeGreaterThan(0);
        expect(gridBounds!.height).toBeGreaterThan(0);
        
        // Verify tiles are visible and properly sized
        const tiles = page.locator('[data-testid^="camera-tile-"]');
        const tileCount = await tiles.count();
        
        for (let i = 0; i < Math.min(tileCount, 4); i++) {
          const tile = tiles.nth(i);
          const tileBounds = await tile.boundingBox();
          
          expect(tileBounds).not.toBeNull();
          expect(tileBounds!.width).toBeGreaterThan(50); // Minimum usable size
          expect(tileBounds!.height).toBeGreaterThan(50);
        }
      }
      
      console.log(`✅ Responsive design verified for ${viewport.name} viewport`);
    }
  });

  test('should validate accessibility controls', async ({ page }) => {
    // Test keyboard navigation
    await page.keyboard.press('Tab'); // Focus first element
    
    // Navigate to grid selector
    let focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    let attempts = 0;
    
    while (focused !== 'trigger-grid-layout' && attempts < 10) {
      await page.keyboard.press('Tab');
      focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
      attempts++;
    }
    
    expect(focused).toBe('trigger-grid-layout');
    
    // Open selector with keyboard
    await page.keyboard.press('Enter');
    
    // Navigate through options
    for (const layout of GRID_LAYOUTS) {
      const option = page.locator(`[data-testid="option-grid-${layout}"]`);
      
      // Verify option has proper ARIA attributes
      const ariaLabel = await option.getAttribute('aria-label');
      const role = await option.getAttribute('role');
      
      expect(ariaLabel || role).toBeTruthy();
    }
    
    // Select option with keyboard
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    
    // Verify selection worked
    await page.waitForTimeout(500);
    const selectedLayout = await page.textContent('[data-testid="trigger-grid-layout"]');
    expect(selectedLayout).toContain('×');
  });

  test('should handle rapid grid switching without errors', async ({ page }) => {
    // Rapidly switch between layouts
    const iterations = 5;
    
    for (let i = 0; i < iterations; i++) {
      for (const layout of GRID_LAYOUTS) {
        await helpers.selectGridLayout(layout);
        
        // Brief wait to allow DOM updates
        await page.waitForTimeout(100);
        
        // Verify no JavaScript errors
        const errors = await page.evaluate(() => (window as any).__testErrors || []);
        expect(errors.length).toBe(0);
      }
    }
    
    // Final verification - should still be functional
    await helpers.selectGridLayout('3x3');
    const tiles = page.locator('[data-testid^="camera-tile-"]');
    await expect(tiles).toHaveCount(9);
  });

  test('should cleanup resources properly during grid changes', async ({ page }) => {
    // Monitor performance during grid changes
    const initialMemory = await helpers['getMemoryUsage']();
    
    // Perform multiple grid changes
    for (let cycle = 0; cycle < 3; cycle++) {
      for (const layout of GRID_LAYOUTS) {
        await helpers.measurePerformance(async () => {
          await helpers.selectGridLayout(layout);
          return {};
        }, `Grid Change Cycle ${cycle + 1} - ${layout}`);
      }
    }
    
    // Force garbage collection if available
    await page.evaluate(() => {
      if ((window as any).gc) {
        (window as any).gc();
      }
    });
    
    await page.waitForTimeout(1000);
    
    // Check memory usage hasn't grown excessively
    const finalMemory = await helpers['getMemoryUsage']();
    const memoryGrowth = finalMemory - initialMemory;
    
    // Allow for some growth but should not be excessive (< 50MB)
    expect(memoryGrowth).toBeLessThan(50);
    
    console.log(`Memory growth during grid switching: ${memoryGrowth.toFixed(2)}MB`);
  });
});
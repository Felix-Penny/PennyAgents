import { Page, expect } from '@playwright/test';

/**
 * Comprehensive test utilities for camera grid integration testing
 * Provides reusable functions for authentication, navigation, and validation
 */

export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Navigate to live feeds page with authentication
   */
  async navigateToLiveFeeds() {
    await this.page.goto('/live-feeds', { waitUntil: 'networkidle' });
    await this.page.waitForSelector('[data-testid="camera-grid"]', { timeout: 30000 });
  }

  /**
   * Authenticate user and navigate to live feeds
   */
  async authenticateAndNavigate() {
    await this.page.goto('/penny-login');
    await this.page.fill('[data-testid="input-email"]', 'test@store.com');
    await this.page.fill('[data-testid="input-password"]', 'password123');
    await this.page.click('[data-testid="button-login"]');
    await this.page.waitForURL('/live-feeds', { timeout: 30000 });
    await this.page.waitForSelector('[data-testid="camera-grid"]');
  }

  /**
   * Wait for WebSocket connection to be established
   */
  async waitForWebSocketConnection() {
    // Wait for WebSocket connection indicator
    await this.page.waitForFunction(() => {
      return window.navigator.onLine && document.readyState === 'complete';
    });
    
    // Additional wait for WebSocket handshake
    await this.page.waitForTimeout(2000);
  }

  /**
   * Select grid layout and verify change
   */
  async selectGridLayout(layout: '1x1' | '2x2' | '3x3' | '4x4') {
    await this.page.click('[data-testid="trigger-grid-layout"]');
    await this.page.click(`[data-testid="option-grid-${layout}"]`);
    
    // Wait for grid to update
    await this.page.waitForTimeout(1000);
    
    // Verify grid layout applied
    const gridSelector = await this.page.textContent('[data-testid="trigger-grid-layout"]');
    expect(gridSelector).toContain(layout.replace('x', '×'));
  }

  /**
   * Get camera tile by index
   */
  async getCameraTile(index: number) {
    return this.page.locator(`[data-testid="camera-tile-${index}"]`);
  }

  /**
   * Toggle camera analysis for specific tile
   */
  async toggleCameraAnalysis(cameraId: string, enable: boolean = true) {
    const buttonSelector = `[data-testid="button-toggle-analysis-${cameraId}"]`;
    const button = this.page.locator(buttonSelector);
    
    // Check current state and toggle if needed
    const isEnabled = await button.evaluate(el => el.classList.contains('ring-2'));
    
    if ((enable && !isEnabled) || (!enable && isEnabled)) {
      await button.click();
    }
    
    // Wait for state change
    await this.page.waitForTimeout(500);
  }

  /**
   * Toggle camera play/pause
   */
  async toggleCameraPlayback(cameraId: string, play: boolean = true) {
    const buttonSelector = `[data-testid="button-play-pause-${cameraId}"]`;
    await this.page.click(buttonSelector);
    await this.page.waitForTimeout(500);
  }

  /**
   * Wait for overlay canvas to render detection
   */
  async waitForOverlayDetection(cameraId: string, timeoutMs: number = 10000) {
    const canvasSelector = `[data-testid="detection-overlay-canvas"]`;
    
    // Wait for canvas to exist and have content
    await this.page.waitForFunction(
      (selector) => {
        const canvas = document.querySelector(selector) as HTMLCanvasElement;
        if (!canvas) return false;
        
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;
        
        // Check if canvas has been drawn on (non-empty)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        return imageData.data.some(pixel => pixel !== 0);
      },
      canvasSelector,
      { timeout: timeoutMs }
    );
  }

  /**
   * Measure performance metrics for an operation
   */
  async measurePerformance<T>(operation: () => Promise<T>, operationName: string): Promise<T & { performanceMetrics: PerformanceMetrics }> {
    const startTime = Date.now();
    const startMemory = await this.getMemoryUsage();
    
    const result = await operation();
    
    const endTime = Date.now();
    const endMemory = await this.getMemoryUsage();
    
    const metrics: PerformanceMetrics = {
      duration: endTime - startTime,
      memoryDelta: endMemory - startMemory,
      operationName,
      timestamp: new Date().toISOString()
    };
    
    console.log(`⏱️ ${operationName}: ${metrics.duration}ms, Memory Δ: ${metrics.memoryDelta}MB`);
    
    return { ...result, performanceMetrics: metrics } as T & { performanceMetrics: PerformanceMetrics };
  }

  /**
   * Get current memory usage in MB
   */
  private async getMemoryUsage(): Promise<number> {
    const memInfo = await this.page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory.usedJSHeapSize / 1024 / 1024;
      }
      return 0;
    });
    return memInfo;
  }

  /**
   * Simulate network condition changes
   */
  async simulateNetworkCondition(condition: 'offline' | 'slow' | 'fast' | 'normal') {
    const conditions = {
      offline: { offline: true },
      slow: { downloadThroughput: 50 * 1024, uploadThroughput: 20 * 1024, latency: 500 },
      fast: { downloadThroughput: 10 * 1024 * 1024, uploadThroughput: 5 * 1024 * 1024, latency: 10 },
      normal: { downloadThroughput: 1 * 1024 * 1024, uploadThroughput: 500 * 1024, latency: 100 }
    };
    
    await this.page.context().route('**/*', route => route.continue());
    if (condition !== 'normal') {
      await this.page.context().route('**/*', route => route.continue());
    }
  }

  /**
   * Check WebSocket connection status
   */
  async checkWebSocketStatus(): Promise<boolean> {
    return await this.page.evaluate(() => {
      // Check if WebSocket connection is active through global state
      return !!(window as any).__wsConnected;
    });
  }

  /**
   * Wait for AI analysis to complete
   */
  async waitForAIAnalysisComplete(cameraId: string, timeoutMs: number = 15000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const isAnalyzing = await this.page.evaluate((id) => {
        // Check analysis state through data attributes or component state
        const tile = document.querySelector(`[data-testid="camera-tile-${id}"]`);
        return tile?.getAttribute('data-analyzing') === 'true';
      }, cameraId);
      
      if (!isAnalyzing) {
        return;
      }
      
      await this.page.waitForTimeout(500);
    }
    
    throw new Error(`AI analysis did not complete within ${timeoutMs}ms for camera ${cameraId}`);
  }

  /**
   * Verify localStorage persistence
   */
  async verifyLocalStoragePersistence(key: string, expectedValue: string) {
    const storedValue = await this.page.evaluate((k) => localStorage.getItem(k), key);
    expect(storedValue).toBe(expectedValue);
  }

  /**
   * Generate mock detection data for testing
   */
  async injectMockDetection(cameraId: string, detectionData: MockDetection) {
    await this.page.evaluate(
      ({ id, data }) => {
        // Inject mock detection through global test interface
        if ((window as any).__injectMockDetection) {
          (window as any).__injectMockDetection(id, data);
        }
      },
      { id: cameraId, data: detectionData }
    );
  }
}

// Types
export interface PerformanceMetrics {
  duration: number;
  memoryDelta: number;
  operationName: string;
  timestamp: string;
}

export interface MockDetection {
  id: string;
  confidence: number;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  label: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// Grid layout utilities
export const GRID_LAYOUTS = ['1x1', '2x2', '3x3', '4x4'] as const;
export type GridLayout = typeof GRID_LAYOUTS[number];

export const GRID_CAMERA_COUNTS = {
  '1x1': 1,
  '2x2': 4,
  '3x3': 9,
  '4x4': 16
} as const;
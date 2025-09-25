import { defineConfig, devices } from '@playwright/test';

/**
 * Comprehensive Playwright Configuration for Camera Grid System Integration Testing
 * Validates production readiness with performance benchmarks and real-time functionality
 */
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  timeout: 60000, // 60 seconds per test for complex integrations
  expect: {
    timeout: 10000, // 10 seconds for assertions
  },
  fullyParallel: false, // Sequential to avoid interference with WebSocket connections
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : 2, // Limited workers for stability
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results/test-results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ],
  use: {
    baseURL: 'http://localhost:5000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    headless: false, // Visual testing for UI components
    viewport: { width: 1920, height: 1080 }, // Standard desktop resolution
    ignoreHTTPSErrors: true,
    actionTimeout: 15000, // 15 seconds for UI actions
    navigationTimeout: 30000, // 30 seconds for page loads
  },
  projects: [
    // Desktop Chrome - Primary testing environment
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    // Firefox for cross-browser validation
    {
      name: 'firefox-desktop',
      use: { ...devices['Desktop Firefox'] },
    },
    // Mobile testing for responsive design
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    // High DPI testing for overlay scaling
    {
      name: 'high-dpi-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 2560, height: 1440 },
        deviceScaleFactor: 2,
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5000',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000, // 2 minutes for server startup
  },
  globalSetup: './tests/global-setup.ts',
  globalTeardown: './tests/global-teardown.ts',
});
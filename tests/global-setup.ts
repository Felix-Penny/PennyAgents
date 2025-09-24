import { chromium, type FullConfig } from '@playwright/test';

/**
 * Global test setup for comprehensive camera grid integration testing
 * Handles authentication, test data setup, and performance monitoring initialization
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting Comprehensive Camera Grid Integration Tests');
  
  // Start performance monitoring
  const startTime = Date.now();
  
  // Create browser instance for authentication setup
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Navigate to login page
    await page.goto('/penny-login', { waitUntil: 'networkidle' });
    
    // Perform authentication
    await page.fill('[data-testid="input-email"]', 'test@store.com');
    await page.fill('[data-testid="input-password"]', 'password123');
    await page.click('[data-testid="button-login"]');
    
    // Wait for successful authentication
    await page.waitForURL('/live-feeds', { timeout: 30000 });
    
    // Save authentication state for test reuse
    await context.storageState({ path: 'tests/auth-state.json' });
    
    console.log('✅ Authentication setup completed');
    
    // Initialize test data and monitoring
    const setupDuration = Date.now() - startTime;
    console.log(`🔧 Global setup completed in ${setupDuration}ms`);
    
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
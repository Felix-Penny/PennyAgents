import { type FullConfig } from '@playwright/test';
import { promises as fs } from 'fs';

/**
 * Global test teardown for comprehensive camera grid integration testing
 * Handles cleanup, result compilation, and performance report generation
 */
async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting global test cleanup');
  
  try {
    // Clean up authentication state
    try {
      await fs.unlink('tests/auth-state.json');
    } catch (error) {
      // File might not exist, ignore
    }
    
    // Generate performance summary report
    await generatePerformanceReport();
    
    console.log('✅ Global teardown completed successfully');
    
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
  }
}

async function generatePerformanceReport() {
  try {
    // Read test results if available
    const resultsPath = 'test-results/test-results.json';
    let testResults = null;
    
    try {
      const resultsData = await fs.readFile(resultsPath, 'utf-8');
      testResults = JSON.parse(resultsData);
    } catch (error) {
      console.log('No test results file found for performance report');
      return;
    }
    
    // Generate performance summary
    const report = {
      timestamp: new Date().toISOString(),
      totalTests: testResults?.stats?.total || 0,
      passedTests: testResults?.stats?.passed || 0,
      failedTests: testResults?.stats?.failed || 0,
      duration: testResults?.stats?.duration || 0,
      summary: 'Comprehensive Camera Grid Integration Test Results'
    };
    
    await fs.writeFile(
      'test-results/performance-summary.json', 
      JSON.stringify(report, null, 2)
    );
    
    console.log('📊 Performance report generated');
    
  } catch (error) {
    console.error('Failed to generate performance report:', error);
  }
}

export default globalTeardown;
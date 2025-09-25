#!/usr/bin/env tsx

/**
 * Direct Test Runner for Facial Recognition Alert Integration
 * Runs the comprehensive test suite without HTTP authentication requirements
 */

import { facialRecognitionAlertTester } from "./tests/facial-recognition-alert-integration.test";

async function runFacialRecognitionIntegrationTest() {
  console.log("🚀 Starting Facial Recognition Alert Integration Test Runner");
  console.log("=" + "=".repeat(70));
  
  try {
    // Run the comprehensive facial recognition test suite
    console.log("🔍 Executing facial recognition alert integration tests...");
    const results = await facialRecognitionAlertTester.runFacialRecognitionTestSuite();
    
    // Generate and display the report
    const report = facialRecognitionAlertTester.generateTestReport();
    console.log(report);
    
    // Summary
    console.log("\n🎯 TEST EXECUTION SUMMARY:");
    console.log("=" + "=".repeat(30));
    console.log(`✅ Total Tests: ${results.totalTests}`);
    console.log(`✅ Passed: ${results.passed}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`📊 Success Rate: ${Math.round((results.passed / results.totalTests) * 100)}%`);
    console.log(`⏱️  Duration: ${results.overallDuration}ms`);
    
    if (results.failed === 0) {
      console.log("\n🎉 ALL FACIAL RECOGNITION ALERT INTEGRATION TESTS PASSED!");
      console.log("✅ The AI facial recognition system successfully integrates with alerts system");
      console.log("✅ Real-time WebSocket notifications are working");
      console.log("✅ Alert metadata includes proper AI analysis data");
      console.log("✅ Consent management and privacy controls are functioning");
      console.log("✅ Watchlist matching triggers high-priority alerts");
      console.log("✅ Alert lifecycle management is working correctly");
      
      process.exit(0);
    } else {
      console.log("\n⚠️  SOME TESTS FAILED - Review errors above");
      console.log("❌ Integration issues detected that need to be addressed");
      
      process.exit(1);
    }
    
  } catch (error) {
    console.error("\n💥 CRITICAL ERROR during test execution:");
    console.error(error);
    console.log("\n❌ Facial recognition alert integration test failed to complete");
    
    process.exit(1);
  }
}

// Run the test if this script is executed directly
// ES module equivalent of require.main === module
if (import.meta.url === `file://${process.argv[1]}`) {
  runFacialRecognitionIntegrationTest();
}
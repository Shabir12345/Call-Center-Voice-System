/**
 * Performance Regression Tests
 * 
 * Tests to detect performance regressions over time.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { PerformanceMonitor } from '../../utils/performanceMonitor';
import { CentralLogger } from '../../utils/logger';
import { SystemOrchestrator } from '../../utils/systemOrchestrator';
import { createTestOrchestratorConfig } from '../../utils/testHelpers';
import { StateManager } from '../../utils/stateManager';

describe('Performance Regression', () => {
  let logger: CentralLogger;
  let performanceMonitor: PerformanceMonitor;
  let orchestrator: SystemOrchestrator;

  beforeEach(async () => {
    logger = new CentralLogger('info');
    performanceMonitor = new PerformanceMonitor(logger);
    
    const config = createTestOrchestratorConfig();
    orchestrator = new SystemOrchestrator(config);
    await orchestrator.initialize();
  });

  it('should maintain response time under threshold', async () => {
    const maxResponseTime = 5000; // 5 seconds
    const numRequests = 10;

    const requestTimes: number[] = [];

    for (let i = 0; i < numRequests; i++) {
      const startTime = Date.now();
      const requestId = performanceMonitor.startRequest('test_agent');
      
      await orchestrator.processCallerInput(`Request ${i}`, `session_${i}`);
      
      performanceMonitor.endRequest(requestId, true);
      const endTime = Date.now();
      requestTimes.push(endTime - startTime);
    }

    const averageTime = requestTimes.reduce((a, b) => a + b, 0) / requestTimes.length;
    const p95Time = requestTimes.sort((a, b) => a - b)[Math.floor(requestTimes.length * 0.95)];

    // Average should be under threshold
    expect(averageTime).toBeLessThan(maxResponseTime);
    
    // P95 should be reasonable (2x average)
    expect(p95Time).toBeLessThan(averageTime * 2);
  });

  it('should handle concurrent requests efficiently', async () => {
    const concurrentRequests = 20;
    const maxConcurrentTime = 10000; // 10 seconds

    const startTime = Date.now();

    const promises = Array.from({ length: concurrentRequests }, (_, i) =>
      orchestrator.processCallerInput(`Concurrent request ${i}`, `session_${i}`)
    );

    await Promise.allSettled(promises);

    const elapsed = Date.now() - startTime;

    // All concurrent requests should complete in reasonable time
    expect(elapsed).toBeLessThan(maxConcurrentTime);
  });

  it('should maintain throughput under load', async () => {
    const numRequests = 50;
    const minRequestsPerSecond = 5; // At least 5 requests per second

    const startTime = Date.now();

    for (let i = 0; i < numRequests; i++) {
      const requestId = performanceMonitor.startRequest('load_test');
      await orchestrator.processCallerInput(`Load test ${i}`, `session_${i}`);
      performanceMonitor.endRequest(requestId, true);
    }

    const elapsed = (Date.now() - startTime) / 1000; // seconds
    const throughput = numRequests / elapsed;

    expect(throughput).toBeGreaterThan(minRequestsPerSecond);
  });

  it('should not degrade performance with many sessions', async () => {
    const stateManager = new StateManager();
    const numSessions = 100;

    // Create many sessions
    for (let i = 0; i < numSessions; i++) {
      await stateManager.createSession(`session_${i}`, `user_${i}`);
    }

    // Performance should still be good
    const startTime = Date.now();
    await orchestrator.processCallerInput('Test request', 'test_session');
    const elapsed = Date.now() - startTime;

    // Should still respond quickly even with many sessions
    expect(elapsed).toBeLessThan(5000);
  });

  it('should maintain performance with large history', async () => {
    const stateManager = new StateManager();
    const sessionId = 'large_history_session';
    
    await stateManager.createSession(sessionId, 'user_1');

    // Add large history
    for (let i = 0; i < 1000; i++) {
      await stateManager.addHistoryEntry(sessionId, {
        role: i % 2 === 0 ? 'user' : 'assistant',
        content: `Message ${i}`,
        timestamp: Date.now()
      });
    }

    // Getting session should still be fast
    const startTime = Date.now();
    const session = await stateManager.getSession(sessionId);
    const elapsed = Date.now() - startTime;

    expect(session).toBeDefined();
    expect(elapsed).toBeLessThan(1000); // Should be under 1 second
  });

  it('should not accumulate errors that slow down system', async () => {
    const numErrors = 100;
    
    // Generate many errors
    for (let i = 0; i < numErrors; i++) {
      const requestId = performanceMonitor.startRequest('error_agent');
      performanceMonitor.endRequest(requestId, false, 'TEST_ERROR');
    }

    // System should still respond quickly
    const startTime = Date.now();
    await orchestrator.processCallerInput('Test after errors', 'test_session');
    const elapsed = Date.now() - startTime;

    expect(elapsed).toBeLessThan(5000);
  });

  it('should maintain consistent performance across requests', async () => {
    const numRequests = 20;
    const responseTimes: number[] = [];

    for (let i = 0; i < numRequests; i++) {
      const startTime = Date.now();
      const requestId = performanceMonitor.startRequest('consistency_test');
      
      await orchestrator.processCallerInput(`Request ${i}`, `session_${i}`);
      
      performanceMonitor.endRequest(requestId, true);
      responseTimes.push(Date.now() - startTime);
    }

    // Calculate variance
    const average = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const variance = responseTimes.reduce((sum, time) => {
      return sum + Math.pow(time - average, 2);
    }, 0) / responseTimes.length;
    const standardDeviation = Math.sqrt(variance);

    // Standard deviation should be less than 50% of average
    // (indicating consistent performance)
    expect(standardDeviation).toBeLessThan(average * 0.5);
  });
});


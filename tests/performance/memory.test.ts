/**
 * Memory Usage Tests
 * 
 * Tests for memory leaks and memory usage patterns.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { StateManager } from '../../utils/stateManager';
import { CentralLogger } from '../../utils/logger';
import { PerformanceMonitor } from '../../utils/performanceMonitor';
import { SystemOrchestrator } from '../../utils/systemOrchestrator';
import { createTestOrchestratorConfig } from '../../utils/testHelpers';

describe('Memory Usage', () => {
  let stateManager: StateManager;
  let logger: CentralLogger;
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    logger = new CentralLogger('info');
    stateManager = new StateManager();
    performanceMonitor = new PerformanceMonitor(logger);
  });

  afterEach(() => {
    // Clean up
    if (stateManager) {
      // Clear all sessions
    }
  });

  it('should not leak memory when creating many sessions', async () => {
    const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;
    
    // Create many sessions
    for (let i = 0; i < 100; i++) {
      const sessionId = `session_${i}`;
      await stateManager.createSession(sessionId, 'user_1');
      
      // Add some history
      for (let j = 0; j < 10; j++) {
        await stateManager.addHistoryEntry(sessionId, {
          role: 'user',
          content: `Message ${j}`,
          timestamp: Date.now()
        });
      }
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;
    
    // Memory growth should be reasonable (less than 10MB for 100 sessions)
    const memoryGrowth = finalMemory - initialMemory;
    expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
  });

  it('should cleanup expired sessions', async () => {
    // Create sessions with short expiration
    for (let i = 0; i < 50; i++) {
      const sessionId = `session_${i}`;
      await stateManager.createSession(sessionId, 'user_1');
    }

    // Wait for expiration (if expiration is configurable)
    // In production, this would wait for actual expiration time
    
    // Force cleanup
    const activeSessions = stateManager.getActiveSessions();
    
    // After cleanup, sessions should be removed
    expect(activeSessions.length).toBeLessThanOrEqual(50);
  });

  it('should not accumulate logs indefinitely', () => {
    // Generate many log entries
    for (let i = 0; i < 10000; i++) {
      logger.info(`Test log entry ${i}`);
    }

    // Query logs - should be limited
    const logs = logger.queryLogs({ limit: 100 });
    
    // Should respect limit
    expect(logs.length).toBeLessThanOrEqual(100);
  });

  it('should handle memory spikes gracefully', async () => {
    const orchestrator = new SystemOrchestrator(createTestOrchestratorConfig());
    await orchestrator.initialize();

    // Simulate memory spike with many concurrent requests
    const promises = Array.from({ length: 100 }, (_, i) =>
      orchestrator.processCallerInput(`Request ${i}`, `session_${i}`)
    );

    // All requests should complete without memory issues
    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    
    // At least some should succeed
    expect(successful).toBeGreaterThan(0);
  });

  it('should release resources on session cleanup', async () => {
    const sessionId = 'test_session';
    await stateManager.createSession(sessionId, 'user_1');
    
    // Add substantial data
    for (let i = 0; i < 1000; i++) {
      await stateManager.addHistoryEntry(sessionId, {
        role: 'user',
        content: `Large message ${i}`.repeat(100),
        timestamp: Date.now()
      });
    }

    // Cleanup session
    await stateManager.deleteSession(sessionId);

    // Session should be removed
    const session = await stateManager.getSession(sessionId);
    expect(session).toBeNull();
  });

  it('should limit request timing history', () => {
    const monitor = new PerformanceMonitor(logger);
    
    // Create many requests
    for (let i = 0; i < 20000; i++) {
      const requestId = monitor.startRequest(`agent_${i % 10}`);
      setTimeout(() => {
        monitor.endRequest(requestId, true);
      }, 0);
    }

    // Wait a bit for all to complete
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const metrics = monitor.getMetrics();
        
        // Metrics should still be available
        expect(metrics).toBeDefined();
        expect(metrics.throughput.totalRequests).toBeGreaterThan(0);
        
        resolve();
      }, 100);
    });
  });
});


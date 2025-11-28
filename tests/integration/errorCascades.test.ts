/**
 * Integration tests for Error Cascades
 * 
 * Tests scenarios where errors propagate through the system
 * and multiple components fail in sequence.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SystemOrchestrator } from '../../utils/systemOrchestrator';
import { createTestOrchestratorConfig } from '../../utils/testHelpers';
import { executeWithFallback, FallbackStrategy, ErrorCode } from '../../utils/errorHandling';
import { CircuitBreaker } from '../../utils/circuitBreaker';
import { ReliabilityMetricsTracker } from '../../utils/reliabilityMetrics';
import { CentralLogger } from '../../utils/logger';

describe('Error Cascades', () => {
  let orchestrator: SystemOrchestrator;
  let reliabilityTracker: ReliabilityMetricsTracker;
  let logger: CentralLogger;

  beforeEach(async () => {
    logger = new CentralLogger('info');
    reliabilityTracker = new ReliabilityMetricsTracker(logger);
    
    const config = createTestOrchestratorConfig();
    orchestrator = new SystemOrchestrator(config);
    await orchestrator.initialize();
  });

  it('should handle cascading failures across multiple services', async () => {
    const failures: string[] = [];

    // Simulate cascade: Service A fails, triggers Service B, which also fails
    const serviceA = async () => {
      failures.push('serviceA');
      throw new Error('Service A failed');
    };

    const serviceB = async () => {
      failures.push('serviceB');
      // Service B depends on A, so it also fails
      throw new Error('Service B failed - dependency unavailable');
    };

    const fallbackChain = [
      {
        strategy: 'alternative_agent' as FallbackStrategy,
        action: async () => {
          failures.push('fallback1');
          // Fallback also fails due to cascade
          throw new Error('Fallback service unavailable');
        }
      },
      {
        strategy: 'degraded_mode' as FallbackStrategy,
        action: async () => {
          failures.push('degraded');
          return { mode: 'degraded', working: true };
        }
      }
    ];

    const result = await executeWithFallback(serviceA, fallbackChain);
    expect(failures.length).toBeGreaterThan(1);
    expect(result).toBeDefined();
    expect(result?.mode).toBe('degraded');
  });

  it('should prevent error cascade with circuit breakers', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeout: 1000
    });

    // Simulate rapid failures that would cause cascade
    let failureCount = 0;
    const failingService = async () => {
      failureCount++;
      throw new Error('Service error');
    };

    // Fail multiple times to open circuit
    try {
      await breaker.execute(failingService);
    } catch (e) {
      // Expected
    }
    try {
      await breaker.execute(failingService);
    } catch (e) {
      // Expected
    }

    expect(breaker.getState()).toBe('open');

    // Circuit is open, so subsequent calls should fail fast
    const startTime = Date.now();
    try {
      await breaker.execute(failingService, async () => 'circuit open - using fallback');
    } catch (e) {
      // Fallback should execute immediately
    }
    const elapsed = Date.now() - startTime;

    // Should fail fast (much less than retry delays)
    expect(elapsed).toBeLessThan(100);
  });

  it('should track cascade incidents in reliability metrics', async () => {
    const incident1 = reliabilityTracker.recordIncident(
      ErrorCode.EXTERNAL_API_FAILURE,
      'high'
    );
    const incident2 = reliabilityTracker.recordIncident(
      ErrorCode.NETWORK_ERROR,
      'critical'
    );

    // Resolve incidents
    reliabilityTracker.resolveIncident(incident1);
    reliabilityTracker.resolveIncident(incident2);

    const metrics = reliabilityTracker.calculateMetrics();
    expect(metrics.totalIncidents).toBeGreaterThanOrEqual(2);
    expect(metrics.criticalIncidents).toBeGreaterThanOrEqual(1);
  });

  it('should handle partial system failures gracefully', async () => {
    // Simulate scenario where some components work, others don't
    const workingComponent = async () => 'Component A working';
    const failingComponent = async () => {
      throw new Error('Component B failed');
    };

    const fallbackActions = [
      {
        strategy: 'degraded_mode' as FallbackStrategy,
        action: async () => ({
          working: ['Component A'],
          failed: ['Component B'],
          mode: 'partial'
        })
      }
    ];

    // Working component should succeed
    const workingResult = await executeWithFallback(workingComponent, fallbackActions);
    expect(workingResult).toBe('Component A working');

    // Failing component should use fallback
    const failingResult = await executeWithFallback(failingComponent, fallbackActions);
    expect(failingResult).toBeDefined();
    expect(failingResult?.mode).toBe('partial');
  });

  it('should handle resource exhaustion scenarios', async () => {
    const resourceExhaustedAction = async () => {
      const error: any = new Error('Memory limit exceeded');
      error.code = 'RESOURCE_EXHAUSTED';
      throw error;
    };

    const fallbackActions = [
      {
        strategy: 'degraded_mode' as FallbackStrategy,
        action: async () => ({
          mode: 'limited_resources',
          message: 'Operating with reduced functionality',
          availableMemory: 'low'
        })
      }
    ];

    const result = await executeWithFallback(resourceExhaustedAction, fallbackActions);
    expect(result).toBeDefined();
    expect(result?.mode).toBe('limited_resources');
  });

  it('should recover from cascade after all systems reset', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeout: 100
    });

    // Open circuit
    try {
      await breaker.execute(async () => {
        throw new Error('Fail');
      });
    } catch (e) {
      // Expected
    }
    try {
      await breaker.execute(async () => {
        throw new Error('Fail');
      });
    } catch (e) {
      // Expected
    }

    expect(breaker.getState()).toBe('open');

    // Wait for reset
    await new Promise(resolve => setTimeout(resolve, 150));

    // Try successful operation
    const result = await breaker.execute(async () => 'Success');
    expect(result).toBe('Success');
    expect(breaker.getState()).toBe('closed');
  });

  it('should handle concurrent error cascades', async () => {
    const concurrentErrors = Array.from({ length: 5 }, (_, i) => {
      return executeWithFallback(
        async () => {
          throw new Error(`Error ${i}`);
        },
        [
          {
            strategy: 'degraded_mode' as FallbackStrategy,
            action: async () => ({ id: i, recovered: true })
          }
        ]
      );
    });

    const results = await Promise.all(concurrentErrors);
    expect(results).toHaveLength(5);
    results.forEach((result, i) => {
      expect(result).toBeDefined();
      expect(result?.id).toBe(i);
      expect(result?.recovered).toBe(true);
    });
  });

  it('should prevent infinite retry loops in cascades', async () => {
    let retryCount = 0;
    const maxRetries = 3;

    const alwaysFailingAction = async () => {
      retryCount++;
      throw new Error('Always fails');
    };

    const fallbackActions = [
      {
        strategy: 'cached_data' as FallbackStrategy,
        action: async () => {
          retryCount++;
          throw new Error('Cache also fails');
        }
      },
      {
        strategy: 'alternative_agent' as FallbackStrategy,
        action: async () => {
          retryCount++;
          return null; // Returns null, which triggers next fallback
        }
      }
    ];

    const result = await executeWithFallback(alwaysFailingAction, fallbackActions);
    
    // Should eventually return null (all fallbacks exhausted)
    expect(result).toBeNull();
    // Should not retry infinitely
    expect(retryCount).toBeLessThan(10);
  });
});


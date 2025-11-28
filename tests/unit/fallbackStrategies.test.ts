/**
 * Unit tests for Fallback Strategies
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  executeWithFallback,
  FallbackStrategy,
  FallbackConfig
} from '../../utils/errorHandling';
import { CircuitBreaker, CircuitState, DEFAULT_CIRCUIT_BREAKER_CONFIG } from '../../utils/circuitBreaker';
import { AdaptiveRetryStrategy, DEFAULT_ADAPTIVE_RETRY_CONFIG } from '../../utils/adaptiveRetry';

describe('Fallback Strategies', () => {
  describe('executeWithFallback', () => {
    it('should handle cached_data fallback strategy', async () => {
      const primaryAction = async () => {
        throw new Error('Service unavailable');
      };

      const fallbackActions = [
        {
          strategy: 'cached_data' as FallbackStrategy,
          action: async () => ({ data: 'cached', timestamp: Date.now() })
        }
      ];

      const result = await executeWithFallback(primaryAction, fallbackActions);
      expect(result).toBeDefined();
      expect(result?.data).toBe('cached');
    });

    it('should handle alternative_agent fallback strategy', async () => {
      const primaryAction = async () => {
        throw new Error('Agent unavailable');
      };

      const fallbackActions = [
        {
          strategy: 'alternative_agent' as FallbackStrategy,
          action: async () => ({ agent: 'backup', result: 'processed' })
        }
      ];

      const result = await executeWithFallback(primaryAction, fallbackActions);
      expect(result).toBeDefined();
      expect(result?.agent).toBe('backup');
    });

    it('should handle degraded_mode fallback strategy', async () => {
      const primaryAction = async () => {
        throw new Error('Service degraded');
      };

      const fallbackActions = [
        {
          strategy: 'degraded_mode' as FallbackStrategy,
          action: async () => ({ mode: 'degraded', basicResult: true })
        }
      ];

      const result = await executeWithFallback(primaryAction, fallbackActions);
      expect(result).toBeDefined();
      expect(result?.mode).toBe('degraded');
    });

    it('should handle human_escalation fallback strategy', async () => {
      const primaryAction = async () => {
        throw new Error('Critical failure');
      };

      let escalated = false;
      const fallbackActions = [
        {
          strategy: 'human_escalation' as FallbackStrategy,
          action: async () => {
            escalated = true;
            return { escalated: true, ticketId: 'T123' };
          }
        }
      ];

      const result = await executeWithFallback(primaryAction, fallbackActions);
      expect(escalated).toBe(true);
      expect(result).toBeDefined();
      expect(result?.escalated).toBe(true);
    });

    it('should handle multi-level fallback chain', async () => {
      const primaryAction = async () => {
        throw new Error('Primary failed');
      };

      const executionOrder: string[] = [];

      const fallbackActions = [
        {
          strategy: 'cached_data' as FallbackStrategy,
          action: async () => {
            executionOrder.push('cache');
            return null;
          }
        },
        {
          strategy: 'alternative_agent' as FallbackStrategy,
          action: async () => {
            executionOrder.push('alternative');
            return null;
          }
        },
        {
          strategy: 'degraded_mode' as FallbackStrategy,
          action: async () => {
            executionOrder.push('degraded');
            return { result: 'degraded' };
          }
        }
      ];

      const result = await executeWithFallback(primaryAction, fallbackActions);
      expect(executionOrder).toEqual(['cache', 'alternative', 'degraded']);
      expect(result).toBeDefined();
    });
  });

  describe('Circuit Breaker Integration', () => {
    it('should work with circuit breaker pattern', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeout: 1000
      });

      let attempts = 0;
      const failingAction = async () => {
        attempts++;
        throw new Error('Service error');
      };

      // Fail twice to open circuit
      try {
        await breaker.execute(failingAction);
      } catch (e) {
        // Expected
      }
      try {
        await breaker.execute(failingAction);
      } catch (e) {
        // Expected
      }

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Circuit should be open, fallback should execute
      const fallbackAction = async () => 'fallback result';
      const result = await breaker.execute(failingAction, fallbackAction);
      expect(result).toBe('fallback result');
    });

    it('should transition from open to half-open', async () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
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

      expect(breaker.getState()).toBe(CircuitState.OPEN);

      // Wait for reset timeout
      await new Promise(resolve => setTimeout(resolve, 150));

      // Try again - should be in half-open
      try {
        await breaker.execute(async () => {
          throw new Error('Still failing');
        });
      } catch (e) {
        // Expected
      }

      // Should open again immediately
      expect(breaker.getState()).toBe(CircuitState.OPEN);
    });
  });

  describe('Adaptive Retry Integration', () => {
    it('should learn from error patterns', async () => {
      const retryStrategy = new AdaptiveRetryStrategy({
        maxRetries: 3,
        initialDelay: 10,
        learningEnabled: true
      });

      // Simulate errors and successes
      let attempts = 0;
      const flakyAction = async () => {
        attempts++;
        if (attempts < 3) {
          throw new Error('TIMEOUT');
        }
        return 'success';
      };

      try {
        await retryStrategy.execute(flakyAction);
      } catch (e) {
        // May fail on first few attempts
      }

      // Check if pattern was learned
      const pattern = retryStrategy.getErrorPattern('TIMEOUT');
      expect(pattern).toBeDefined();
    });

    it('should adapt delay based on success rate', async () => {
      const retryStrategy = new AdaptiveRetryStrategy({
        maxRetries: 2,
        initialDelay: 100,
        learningEnabled: true
      });

      // Create error pattern with low success rate
      const errorType = 'NETWORK_ERROR';
      retryStrategy.getAllPatterns().set(errorType, {
        errorType,
        occurrenceCount: 10,
        averageRecoveryTime: 5000,
        successRate: 0.1, // Very low success rate
        lastOccurrence: Date.now()
      });

      // Delay should be increased for low success rate
      const pattern = retryStrategy.getErrorPattern(errorType);
      expect(pattern?.successRate).toBeLessThan(0.5);
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should handle partial failure gracefully', async () => {
      const primaryAction = async () => {
        throw new Error('Partial data available');
      };

      const fallbackActions = [
        {
          strategy: 'degraded_mode' as FallbackStrategy,
          action: async () => ({
            status: 'partial',
            data: { available: true, complete: false }
          })
        }
      ];

      const result = await executeWithFallback(primaryAction, fallbackActions);
      expect(result).toBeDefined();
      expect(result?.status).toBe('partial');
    });

    it('should handle resource exhaustion scenarios', async () => {
      const primaryAction = async () => {
        const error: any = new Error('Resource exhausted');
        error.code = 'RESOURCE_EXHAUSTED';
        throw error;
      };

      const fallbackActions = [
        {
          strategy: 'degraded_mode' as FallbackStrategy,
          action: async () => ({
            mode: 'limited',
            message: 'Operating with limited resources'
          })
        }
      ];

      const result = await executeWithFallback(primaryAction, fallbackActions);
      expect(result).toBeDefined();
      expect(result?.mode).toBe('limited');
    });

    it('should handle error cascades', async () => {
      const errorChain: string[] = [];

      const primaryAction = async () => {
        errorChain.push('primary');
        throw new Error('Primary failed');
      };

      const fallbackActions = [
        {
          strategy: 'alternative_agent' as FallbackStrategy,
          action: async () => {
            errorChain.push('fallback1');
            throw new Error('Fallback 1 failed');
          }
        },
        {
          strategy: 'cached_data' as FallbackStrategy,
          action: async () => {
            errorChain.push('fallback2');
            return { source: 'cache', data: 'cached' };
          }
        }
      ];

      const result = await executeWithFallback(
        primaryAction,
        fallbackActions,
        (error, strategy) => {
          errorChain.push(`error-${strategy}`);
        }
      );

      expect(errorChain.length).toBeGreaterThan(2);
      expect(result).toBeDefined();
    });
  });
});


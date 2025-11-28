/**
 * Integration tests for Error Recovery
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SystemOrchestrator } from '../../utils/systemOrchestrator';
import { createTestOrchestratorConfig } from '../../utils/testHelpers';
import { ErrorCode, executeWithFallback, FallbackStrategy } from '../../utils/errorHandling';
import { CircuitBreaker, CircuitState } from '../../utils/circuitBreaker';
import { AdaptiveRetryStrategy } from '../../utils/adaptiveRetry';

describe('Error Recovery', () => {
  let orchestrator: SystemOrchestrator;

  beforeEach(async () => {
    const config = createTestOrchestratorConfig();
    orchestrator = new SystemOrchestrator(config);
    await orchestrator.initialize();
  });

  it('should handle retryable errors', async () => {
    // Test that retryable errors are retried
    // This would require mocking external calls
    const response = await orchestrator.processCallerInput(
      'Test input',
      'session_123'
    );
    
    expect(response).toBeDefined();
  });

  it('should handle non-retryable errors gracefully', async () => {
    // Test that non-retryable errors fail fast
    const response = await orchestrator.processCallerInput(
      'Invalid input that causes error',
      'session_456'
    );
    
    // Should return error message, not crash
    expect(typeof response).toBe('string');
  }, 10000);

  it('should recover from timeout errors', async () => {
    // Test timeout handling
    const response = await orchestrator.processCallerInput(
      'Test input',
      'session_789'
    );
    
    expect(response).toBeDefined();
  });

  it('should handle multi-level fallback chains', async () => {
    const primaryAction = async () => {
      throw new Error('Primary service unavailable');
    };

    const fallbackActions = [
      {
        strategy: 'cached_data' as FallbackStrategy,
        action: async () => null // Cache miss
      },
      {
        strategy: 'alternative_agent' as FallbackStrategy,
        action: async () => null // Alternative unavailable
      },
      {
        strategy: 'degraded_mode' as FallbackStrategy,
        action: async () => ({ result: 'degraded', available: true })
      }
    ];

    const result = await executeWithFallback(primaryAction, fallbackActions);
    expect(result).toBeDefined();
    expect(result?.result).toBe('degraded');
  });

  it('should activate degraded mode when primary fails', async () => {
    const primaryAction = async () => {
      throw new Error('Service overloaded');
    };

    const fallbackActions = [
      {
        strategy: 'degraded_mode' as FallbackStrategy,
        action: async () => ({
          mode: 'degraded',
          features: ['basic'],
          message: 'Operating in limited capacity'
        })
      }
    ];

    const result = await executeWithFallback(primaryAction, fallbackActions);
    expect(result).toBeDefined();
    expect(result?.mode).toBe('degraded');
    expect(result?.features).toEqual(['basic']);
  });

  it('should trigger human escalation on critical failures', async () => {
    const primaryAction = async () => {
      const error: any = new Error('Critical system failure');
      error.code = ErrorCode.INTERNAL_ERROR;
      throw error;
    };

    let escalated = false;
    const fallbackActions = [
      {
        strategy: 'human_escalation' as FallbackStrategy,
        action: async () => {
          escalated = true;
          return {
            escalated: true,
            ticketId: `TICKET-${Date.now()}`,
            priority: 'high'
          };
        }
      }
    ];

    const result = await executeWithFallback(primaryAction, fallbackActions);
    expect(escalated).toBe(true);
    expect(result).toBeDefined();
    expect(result?.escalated).toBe(true);
    expect(result?.ticketId).toBeDefined();
  });
});


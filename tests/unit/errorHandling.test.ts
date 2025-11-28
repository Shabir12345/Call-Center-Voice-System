/**
 * Unit tests for Error Handling
 */

import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  createErrorResponse,
  getUserFriendlyErrorMessage,
  isRetryableError,
  calculateRetryDelay,
  shouldRetry,
  DEFAULT_RETRY_CONFIG,
  executeWithFallback,
  FallbackStrategy
} from '../../utils/errorHandling';

describe('Error Handling', () => {
  describe('createErrorResponse', () => {
    it('should create error response with code and message', () => {
      const error = createErrorResponse(
        ErrorCode.EXTERNAL_API_FAILURE,
        'API call failed'
      );

      expect(error.code).toBe(ErrorCode.EXTERNAL_API_FAILURE);
      expect(error.message).toBeDefined();
      expect(error.retryable).toBe(true);
    });

    it('should include user-friendly message', () => {
      const error = createErrorResponse(ErrorCode.RESERVATION_NOT_FOUND);
      expect(error.userFriendlyMessage).toBeDefined();
    });
  });

  describe('getUserFriendlyErrorMessage', () => {
    it('should return user-friendly message for known error', () => {
      const message = getUserFriendlyErrorMessage(ErrorCode.NETWORK_ERROR);
      expect(message).toBeDefined();
      expect(typeof message).toBe('string');
    });

    it('should return default message for unknown error', () => {
      const message = getUserFriendlyErrorMessage('UNKNOWN_ERROR' as ErrorCode);
      expect(message).toContain('error occurred');
    });
  });

  describe('isRetryableError', () => {
    it('should identify retryable errors', () => {
      expect(isRetryableError(ErrorCode.NETWORK_ERROR)).toBe(true);
      expect(isRetryableError(ErrorCode.TIMEOUT_ERROR)).toBe(true);
    });

    it('should identify non-retryable errors', () => {
      expect(isRetryableError(ErrorCode.INVALID_INPUT)).toBe(false);
      expect(isRetryableError(ErrorCode.UNAUTHORIZED)).toBe(false);
    });
  });

  describe('calculateRetryDelay', () => {
    it('should calculate exponential backoff', () => {
      const delay1 = calculateRetryDelay(0);
      const delay2 = calculateRetryDelay(1);
      const delay3 = calculateRetryDelay(2);

      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    it('should respect max delay', () => {
      const delay = calculateRetryDelay(10, {
        ...DEFAULT_RETRY_CONFIG,
        maxDelayMs: 1000
      });
      expect(delay).toBeLessThanOrEqual(1000);
    });
  });

  describe('shouldRetry', () => {
    it('should allow retry for retryable errors', () => {
      expect(shouldRetry(ErrorCode.NETWORK_ERROR, 0)).toBe(true);
      expect(shouldRetry(ErrorCode.NETWORK_ERROR, 1)).toBe(true);
    });

    it('should not retry beyond max retries', () => {
      expect(shouldRetry(ErrorCode.NETWORK_ERROR, 3, {
        ...DEFAULT_RETRY_CONFIG,
        maxRetries: 2
      })).toBe(false);
    });
  });

  describe('executeWithFallback', () => {
    it('should return primary action result on success', async () => {
      const primaryAction = async () => 'success';
      const fallbackActions: Array<{
        strategy: FallbackStrategy;
        action: () => Promise<string | null>;
      }> = [];

      const result = await executeWithFallback(primaryAction, fallbackActions);
      expect(result).toBe('success');
    });

    it('should execute fallback when primary fails', async () => {
      const primaryAction = async () => {
        throw new Error('Primary failed');
      };
      const fallbackActions: Array<{
        strategy: FallbackStrategy;
        action: () => Promise<string | null>;
      }> = [
        {
          strategy: 'cached_data',
          action: async () => 'fallback result'
        }
      ];

      const result = await executeWithFallback(primaryAction, fallbackActions);
      expect(result).toBe('fallback result');
    });

    it('should try multiple fallbacks in order', async () => {
      const primaryAction = async () => {
        throw new Error('Primary failed');
      };
      let fallbackOrder: string[] = [];
      
      const fallbackActions: Array<{
        strategy: FallbackStrategy;
        action: () => Promise<string | null>;
      }> = [
        {
          strategy: 'cached_data',
          action: async () => {
            fallbackOrder.push('fallback1');
            return null; // First fallback fails
          }
        },
        {
          strategy: 'alternative_agent',
          action: async () => {
            fallbackOrder.push('fallback2');
            return 'fallback2 result';
          }
        }
      ];

      const result = await executeWithFallback(primaryAction, fallbackActions);
      expect(result).toBe('fallback2 result');
      expect(fallbackOrder).toEqual(['fallback1', 'fallback2']);
    });

    it('should return null when all fallbacks fail', async () => {
      const primaryAction = async () => {
        throw new Error('Primary failed');
      };
      const fallbackActions: Array<{
        strategy: FallbackStrategy;
        action: () => Promise<string | null>;
      }> = [
        {
          strategy: 'cached_data',
          action: async () => null
        },
        {
          strategy: 'alternative_agent',
          action: async () => null
        }
      ];

      const result = await executeWithFallback(primaryAction, fallbackActions);
      expect(result).toBeNull();
    });

    it('should call onError callback for each failure', async () => {
      const primaryAction = async () => {
        throw new Error('Primary failed');
      };
      const errorCalls: Array<{ error: any; strategy: FallbackStrategy }> = [];
      
      const fallbackActions: Array<{
        strategy: FallbackStrategy;
        action: () => Promise<string | null>;
      }> = [
        {
          strategy: 'cached_data',
          action: async () => {
            throw new Error('Fallback failed');
          }
        }
      ];

      await executeWithFallback(
        primaryAction,
        fallbackActions,
        (error, strategy) => {
          errorCalls.push({ error, strategy });
        }
      );

      expect(errorCalls.length).toBeGreaterThan(0);
      expect(errorCalls[0].strategy).toBe('primary');
    });

    it('should handle all error categories', () => {
      // Test that all error codes are properly categorized
      const allErrorCodes = Object.values(ErrorCode);
      
      allErrorCodes.forEach(errorCode => {
        const error = createErrorResponse(errorCode);
        expect(error.code).toBe(errorCode);
        expect(error.userFriendlyMessage).toBeDefined();
        expect(typeof error.retryable).toBe('boolean');
      });
    });

    it('should handle timeout escalation paths', async () => {
      const primaryAction = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        throw new Error('Timeout');
      };

      const result = await executeWithFallback(
        primaryAction,
        [
          {
            strategy: 'degraded_mode',
            action: async () => 'degraded result'
          }
        ]
      );

      expect(result).toBe('degraded result');
    });

    it('should handle concurrent error scenarios', async () => {
      const promises = Array.from({ length: 5 }, (_, i) =>
        executeWithFallback(
          async () => {
            if (i % 2 === 0) throw new Error(`Error ${i}`);
            return `success ${i}`;
          },
          [
            {
              strategy: 'cached_data',
              action: async () => `fallback ${i}`
            }
          ]
        )
      );

      const results = await Promise.all(promises);
      expect(results).toHaveLength(5);
      results.forEach((result, i) => {
        if (i % 2 === 0) {
          expect(result).toBe(`fallback ${i}`);
        } else {
          expect(result).toBe(`success ${i}`);
        }
      });
    });
  });
});


/**
 * Unit tests for Circuit Breaker
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker, CircuitState, DEFAULT_CIRCUIT_BREAKER_CONFIG } from '../../utils/circuitBreaker';

describe('Circuit Breaker', () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker({
      failureThreshold: 2,
      resetTimeout: 100
    });
  });

  it('should start in closed state', () => {
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('should execute successful requests', async () => {
    const result = await breaker.execute(async () => 'success');
    expect(result).toBe('success');
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('should open circuit after failure threshold', async () => {
    // Fail twice to open circuit
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

    expect(breaker.getState()).toBe(CircuitState.OPEN);
  });

  it('should use fallback when circuit is open', async () => {
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

    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // Execute with fallback
    const result = await breaker.execute(
      async () => {
        throw new Error('Should not execute');
      },
      async () => 'fallback result'
    );

    expect(result).toBe('fallback result');
  });

  it('should transition to half-open after reset timeout', async () => {
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

    expect(breaker.getState()).toBe(CircuitState.OPEN);

    // Wait for reset timeout
    await new Promise(resolve => setTimeout(resolve, 150));

    // Try again - should be in half-open
    const result = await breaker.execute(
      async () => {
        throw new Error('Still failing');
      },
      async () => 'fallback'
    );

    expect(result).toBe('fallback');
  });

  it('should close circuit after success threshold in half-open', async () => {
    breaker = new CircuitBreaker({
      failureThreshold: 1,
      successThreshold: 2,
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

    // Wait for reset
    await new Promise(resolve => setTimeout(resolve, 150));

    // Succeed twice to close circuit
    await breaker.execute(async () => 'success1');
    await breaker.execute(async () => 'success2');

    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('should track statistics', () => {
    const stats = breaker.getStats();
    expect(stats.state).toBe(CircuitState.CLOSED);
    expect(stats.totalRequests).toBe(0);
    expect(stats.totalFailures).toBe(0);
    expect(stats.totalSuccesses).toBe(0);
  });

  it('should reset circuit', () => {
    breaker.open();
    expect(breaker.getState()).toBe(CircuitState.OPEN);

    breaker.reset();
    expect(breaker.getState()).toBe(CircuitState.CLOSED);
  });

  it('should handle timeout', async () => {
    breaker = new CircuitBreaker({
      timeout: 50
    });

    await expect(
      breaker.execute(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'too slow';
      })
    ).rejects.toThrow();
  });
});


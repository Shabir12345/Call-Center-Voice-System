/**
 * Circuit Breaker Pattern
 * 
 * Implements circuit breaker pattern for external service calls.
 * Prevents cascading failures by opening the circuit when failure threshold is reached.
 */

/**
 * Circuit breaker state
 */
export enum CircuitState {
  CLOSED = 'closed',    // Normal operation
  OPEN = 'open',        // Circuit is open, requests fail fast
  HALF_OPEN = 'half_open' // Testing if service recovered
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of failures before opening circuit
  successThreshold: number;      // Number of successes to close from half-open
  timeout: number;               // Time in ms to wait before attempting half-open
  resetTimeout: number;          // Time in ms before transitioning from open to half-open
}

/**
 * Default circuit breaker configuration
 */
export const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 1000,
  resetTimeout: 60000  // 1 minute
};

/**
 * Circuit breaker statistics
 */
export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
}

/**
 * Circuit breaker class
 */
export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private totalRequests: number = 0;
  private totalFailures: number = 0;
  private totalSuccesses: number = 0;
  private config: CircuitBreakerConfig;
  private halfOpenTimer?: ReturnType<typeof setTimeout>;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => Promise<T> | T
  ): Promise<T> {
    this.totalRequests++;

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      const timeSinceLastFailure = Date.now() - (this.lastFailureTime || 0);
      
      if (timeSinceLastFailure >= this.config.resetTimeout) {
        // Transition to half-open
        this.state = CircuitState.HALF_OPEN;
        this.successes = 0;
      } else {
        // Circuit is still open, return fallback or throw
        if (fallback) {
          return await Promise.resolve(fallback());
        }
        throw new Error('Circuit breaker is OPEN - service unavailable');
      }
    }

    try {
      // Execute the function with timeout
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), this.config.timeout)
        )
      ]);

      // Success
      this.onSuccess();
      return result;
    } catch (error) {
      // Failure
      this.onFailure();
      
      if (fallback) {
        return await Promise.resolve(fallback());
      }
      
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.lastSuccessTime = Date.now();
    this.totalSuccesses++;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      
      if (this.successes >= this.config.successThreshold) {
        // Close the circuit
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.successes = 0;
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success
      this.failures = 0;
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.lastFailureTime = Date.now();
    this.totalFailures++;
    this.failures++;

    if (this.state === CircuitState.HALF_OPEN) {
      // Immediately open the circuit again
      this.state = CircuitState.OPEN;
      this.successes = 0;
    } else if (this.state === CircuitState.CLOSED) {
      // Check if we've reached the failure threshold
      if (this.failures >= this.config.failureThreshold) {
        this.state = CircuitState.OPEN;
      }
    }
  }

  /**
   * Get current statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
      totalSuccesses: this.totalSuccesses
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Reset circuit breaker to closed state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = undefined;
    this.lastSuccessTime = undefined;
    
    if (this.halfOpenTimer) {
      clearTimeout(this.halfOpenTimer);
      this.halfOpenTimer = undefined;
    }
  }

  /**
   * Manually open the circuit
   */
  open(): void {
    this.state = CircuitState.OPEN;
    this.lastFailureTime = Date.now();
  }

  /**
   * Manually close the circuit
   */
  close(): void {
    this.reset();
  }
}

/**
 * Circuit breaker manager for multiple services
 */
export class CircuitBreakerManager {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Get or create circuit breaker for a service
   */
  getBreaker(serviceName: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
    if (!this.breakers.has(serviceName)) {
      this.breakers.set(serviceName, new CircuitBreaker(config));
    }
    return this.breakers.get(serviceName)!;
  }

  /**
   * Get all circuit breaker stats
   */
  getAllStats(): Record<string, CircuitBreakerStats> {
    const stats: Record<string, CircuitBreakerStats> = {};
    this.breakers.forEach((breaker, name) => {
      stats[name] = breaker.getStats();
    });
    return stats;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    this.breakers.forEach(breaker => breaker.reset());
  }
}

/**
 * Global circuit breaker manager instance
 */
export const circuitBreakerManager = new CircuitBreakerManager();


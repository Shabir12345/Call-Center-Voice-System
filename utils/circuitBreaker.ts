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
  enablePersistence?: boolean;   // Enable state persistence (default: false)
  persistenceKey?: string;       // Storage key for persistence (required if enablePersistence=true)
  onStateChange?: (state: CircuitState, serviceName?: string) => void;  // Callback for state changes
  onMetric?: (metric: { type: 'request' | 'success' | 'failure'; serviceName?: string }) => void;  // Callback for metrics
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
  private serviceName?: string; // Track service name for callbacks

  constructor(config: Partial<CircuitBreakerConfig> = {}, serviceName?: string) {
    this.config = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...config };
    this.serviceName = serviceName;
    
    // Load persisted state if enabled
    if (this.config.enablePersistence && this.config.persistenceKey) {
      this.loadPersistedState();
    }
  }

  /**
   * Set service name (for monitoring callbacks)
   */
  setServiceName(name: string): void {
    this.serviceName = name;
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(
    fn: () => Promise<T>,
    fallback?: () => Promise<T> | T
  ): Promise<T> {
    this.totalRequests++;
    
    // Emit metric callback
    this.config.onMetric?.({ type: 'request', serviceName: this.serviceName });

    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      const timeSinceLastFailure = Date.now() - (this.lastFailureTime || 0);
      
      if (timeSinceLastFailure >= this.config.resetTimeout) {
        // Transition to half-open
        const previousState = this.state;
        this.state = CircuitState.HALF_OPEN;
        this.successes = 0;
        this.notifyStateChange(previousState, this.state);
        this.persistState();
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
      this.config.onMetric?.({ type: 'success', serviceName: this.serviceName });
      return result;
    } catch (error) {
      // Failure
      this.onFailure();
      this.config.onMetric?.({ type: 'failure', serviceName: this.serviceName });
      
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
        const previousState = this.state;
        this.state = CircuitState.CLOSED;
        this.failures = 0;
        this.successes = 0;
        this.notifyStateChange(previousState, this.state);
        this.persistState();
      }
    } else if (this.state === CircuitState.CLOSED) {
      // Reset failure count on success
      this.failures = 0;
    }
    
    this.persistState();
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
      const previousState = this.state;
      this.state = CircuitState.OPEN;
      this.successes = 0;
      this.notifyStateChange(previousState, this.state);
      this.persistState();
    } else if (this.state === CircuitState.CLOSED) {
      // Check if we've reached the failure threshold
      if (this.failures >= this.config.failureThreshold) {
        const previousState = this.state;
        this.state = CircuitState.OPEN;
        this.notifyStateChange(previousState, this.state);
        this.persistState();
      }
    }
  }

  /**
   * Notify state change callback
   */
  private notifyStateChange(previousState: CircuitState, newState: CircuitState): void {
    if (previousState !== newState && this.config.onStateChange) {
      this.config.onStateChange(newState, this.serviceName);
    }
  }

  /**
   * Persist state to storage (if enabled)
   */
  private persistState(): void {
    if (!this.config.enablePersistence || !this.config.persistenceKey) {
      return;
    }

    try {
      const stateToPersist = {
        state: this.state,
        failures: this.failures,
        lastFailureTime: this.lastFailureTime,
        totalFailures: this.totalFailures,
        totalSuccesses: this.totalSuccesses,
        timestamp: Date.now()
      };

      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(
          this.config.persistenceKey!,
          JSON.stringify(stateToPersist)
        );
      }
    } catch (error) {
      // Silently fail if persistence is not available
      console.warn('Failed to persist circuit breaker state:', error);
    }
  }

  /**
   * Load persisted state from storage (if enabled)
   */
  private loadPersistedState(): void {
    if (!this.config.enablePersistence || !this.config.persistenceKey) {
      return;
    }

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const persisted = localStorage.getItem(this.config.persistenceKey!);
        if (persisted) {
          const stateData = JSON.parse(persisted);
          
          // Only restore if state is less than 5 minutes old (stale data)
          const stateAge = Date.now() - (stateData.timestamp || 0);
          if (stateAge < 5 * 60 * 1000) {
            this.state = stateData.state;
            this.failures = stateData.failures || 0;
            this.lastFailureTime = stateData.lastFailureTime;
            this.totalFailures = stateData.totalFailures || 0;
            this.totalSuccesses = stateData.totalSuccesses || 0;
          }
        }
      }
    } catch (error) {
      // Silently fail if loading fails
      console.warn('Failed to load persisted circuit breaker state:', error);
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


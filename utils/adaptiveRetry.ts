/**
 * Adaptive Retry Strategy
 * 
 * Implements adaptive retry logic that learns from error patterns
 * and adjusts retry behavior based on historical data.
 */

import { RetryConfig, DEFAULT_RETRY_CONFIG } from './errorHandling';

/**
 * Error pattern data
 */
export interface ErrorPattern {
  errorType: string;
  occurrenceCount: number;
  averageRecoveryTime: number;
  successRate: number;
  lastOccurrence: number;
}

/**
 * Adaptive retry configuration
 */
export interface AdaptiveRetryConfig extends RetryConfig {
  learningEnabled: boolean;
  patternHistorySize: number;
  minSuccessRate: number;
  maxAdaptiveDelay: number;
}

/**
 * Default adaptive retry configuration
 */
export const DEFAULT_ADAPTIVE_RETRY_CONFIG: AdaptiveRetryConfig = {
  ...DEFAULT_RETRY_CONFIG,
  learningEnabled: true,
  patternHistorySize: 100,
  minSuccessRate: 0.1,  // 10% minimum success rate to keep retrying
  maxAdaptiveDelay: 30000  // 30 seconds max delay
};

/**
 * Adaptive retry strategy
 */
export class AdaptiveRetryStrategy {
  private errorPatterns: Map<string, ErrorPattern> = new Map();
  private config: AdaptiveRetryConfig;
  private retryHistory: Array<{
    errorType: string;
    attempt: number;
    success: boolean;
    delay: number;
    timestamp: number;
  }> = [];

  constructor(config: Partial<AdaptiveRetryConfig> = {}) {
    this.config = { ...DEFAULT_ADAPTIVE_RETRY_CONFIG, ...config };
  }

  /**
   * Execute with adaptive retry
   */
  async execute<T>(
    fn: () => Promise<T>,
    shouldRetry?: (error: any) => boolean
  ): Promise<T> {
    let lastError: any;
    
    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const result = await fn();
        
        // Record success if this was a retry
        if (attempt > 0 && lastError) {
          this.recordRetryResult(lastError, attempt, true);
        }
        
        return result;
      } catch (error: any) {
        lastError = error;
        
        // Check if we should retry
        if (shouldRetry && !shouldRetry(error)) {
          throw error;
        }
        
        // Don't retry on last attempt
        if (attempt >= this.config.maxRetries) {
          if (attempt > 0) {
            this.recordRetryResult(error, attempt, false);
          }
          break;
        }
        
        // Calculate adaptive delay
        const delay = this.calculateAdaptiveDelay(error, attempt);
        
        // Record retry attempt
        if (this.config.learningEnabled) {
          this.recordRetryAttempt(error, attempt, delay);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError;
  }

  /**
   * Calculate adaptive delay based on error patterns
   */
  private calculateAdaptiveDelay(error: any, attempt: number): number {
    if (!this.config.learningEnabled) {
      // Fall back to standard exponential backoff
      return Math.min(
        this.config.initialDelay * Math.pow(2, attempt),
        this.config.maxDelay
      );
    }

    const errorType = this.getErrorType(error);
    const pattern = this.errorPatterns.get(errorType);

    if (!pattern || pattern.occurrenceCount < 3) {
      // Not enough data, use standard backoff
      return Math.min(
        this.config.initialDelay * Math.pow(2, attempt),
        this.config.maxDelay
      );
    }

    // Use learned recovery time if available
    let baseDelay = pattern.averageRecoveryTime;
    
    // Adjust based on success rate
    if (pattern.successRate < this.config.minSuccessRate) {
      // Very low success rate, increase delay significantly
      baseDelay *= 2;
    } else if (pattern.successRate < 0.5) {
      // Low success rate, increase delay moderately
      baseDelay *= 1.5;
    }

    // Still apply exponential backoff for this attempt
    const adaptiveDelay = Math.min(
      baseDelay * Math.pow(1.5, attempt),
      this.config.maxAdaptiveDelay
    );

    // Ensure delay is within bounds
    return Math.max(
      this.config.initialDelay,
      Math.min(adaptiveDelay, this.config.maxAdaptiveDelay)
    );
  }

  /**
   * Get error type from error object
   */
  private getErrorType(error: any): string {
    if (error?.code) return error.code;
    if (error?.errorCode) return error.errorCode;
    if (error?.name) return error.name;
    if (error?.message) {
      // Extract type from message
      const msg = error.message.toLowerCase();
      if (msg.includes('timeout')) return 'TIMEOUT';
      if (msg.includes('network')) return 'NETWORK';
      if (msg.includes('connection')) return 'CONNECTION';
      if (msg.includes('rate limit')) return 'RATE_LIMIT';
    }
    return 'UNKNOWN';
  }

  /**
   * Record retry attempt
   */
  private recordRetryAttempt(error: any, attempt: number, delay: number): void {
    this.retryHistory.push({
      errorType: this.getErrorType(error),
      attempt,
      success: false,  // Will be updated on success/failure
      delay,
      timestamp: Date.now()
    });

    // Trim history if too large
    if (this.retryHistory.length > this.config.patternHistorySize) {
      this.retryHistory = this.retryHistory.slice(-this.config.patternHistorySize);
    }
  }

  /**
   * Record retry result (success or failure)
   */
  private recordRetryResult(error: any, attempt: number, success: boolean): void {
    const errorType = this.getErrorType(error);
    
    // Update history entry if found
    const historyEntry = this.retryHistory.find(
      entry => entry.errorType === errorType && entry.attempt === attempt
    );
    
    if (historyEntry) {
      historyEntry.success = success;
    }

    // Update error pattern
    const pattern = this.errorPatterns.get(errorType) || {
      errorType,
      occurrenceCount: 0,
      averageRecoveryTime: this.config.initialDelay,
      successRate: 0.5,
      lastOccurrence: Date.now()
    };

    pattern.occurrenceCount++;
    pattern.lastOccurrence = Date.now();

    // Update success rate
    const recentRetries = this.retryHistory.filter(
      entry => entry.errorType === errorType && entry.attempt > 0
    );
    if (recentRetries.length > 0) {
      const successfulRetries = recentRetries.filter(entry => entry.success).length;
      pattern.successRate = successfulRetries / recentRetries.length;
    }

    // Update average recovery time (only for successful retries)
    if (success && historyEntry) {
      const recoveryTime = Date.now() - historyEntry.timestamp;
      pattern.averageRecoveryTime = 
        (pattern.averageRecoveryTime * (pattern.occurrenceCount - 1) + recoveryTime) / 
        pattern.occurrenceCount;
    }

    this.errorPatterns.set(errorType, pattern);
  }

  /**
   * Get error pattern for a specific error type
   */
  getErrorPattern(errorType: string): ErrorPattern | undefined {
    return this.errorPatterns.get(errorType);
  }

  /**
   * Get all error patterns
   */
  getAllPatterns(): Map<string, ErrorPattern> {
    return new Map(this.errorPatterns);
  }

  /**
   * Reset learning data
   */
  reset(): void {
    this.errorPatterns.clear();
    this.retryHistory = [];
  }
}


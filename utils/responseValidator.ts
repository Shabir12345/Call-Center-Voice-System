/**
 * Response Validator and Normalizer
 * 
 * Provides utilities for validating and normalizing sub-agent responses
 * to ensure consistent format across direct calls and session-based calls.
 */

import { ValidationResult, NormalizedResponse, SubAgentResponse } from '../types';

/**
 * Validates a sub-agent response to ensure it's properly formatted
 * @param response - The response to validate
 * @returns Validation result with error details if invalid
 */
export function validateSubAgentResponse(response: any): ValidationResult {
  // Check if response exists
  if (!response) {
    return {
      isValid: false,
      error: 'Response is null or undefined',
      errorCode: 'EMPTY_RESPONSE'
    };
  }

  // Check if response is an object
  if (typeof response !== 'object') {
    return {
      isValid: false,
      error: 'Response must be an object',
      errorCode: 'INVALID_TYPE'
    };
  }

  // For session-based responses, check for text or data
  if (response.text !== undefined) {
    if (typeof response.text !== 'string') {
      return {
        isValid: false,
        error: 'Response text must be a string',
        errorCode: 'INVALID_TEXT_TYPE'
      };
    }
    if (response.text.trim().length === 0) {
      return {
        isValid: false,
        error: 'Response text is empty',
        errorCode: 'EMPTY_TEXT'
      };
    }
  }

  // For direct tool responses, check for data or error
  if (response.data !== undefined || response.error !== undefined) {
    // Valid structure
    return { isValid: true };
  }

  // If it has text, it's valid
  if (response.text && response.text.trim().length > 0) {
    return { isValid: true };
  }

  // If it has any meaningful data, consider it valid
  if (Object.keys(response).length > 0) {
    return { isValid: true };
  }

  return {
    isValid: false,
    error: 'Response has no valid content (text, data, or error)',
    errorCode: 'NO_CONTENT'
  };
}

/**
 * Normalizes a sub-agent response to a consistent format
 * @param response - The raw response from sub-agent
 * @param source - Whether this came from a direct call or session-based call
 * @param metadata - Optional metadata (duration, retry count, etc.)
 * @returns Normalized response with consistent structure
 */
export function normalizeSubAgentResponse(
  response: any,
  source: 'direct' | 'session',
  metadata?: { duration?: number; retryCount?: number }
): NormalizedResponse {
  const timestamp = Date.now();

  // Handle error responses
  if (response?.error) {
    return {
      success: false,
      data: null,
      error: typeof response.error === 'string' ? response.error : 'Unknown error occurred',
      errorCode: response.errorCode || 'UNKNOWN_ERROR',
      metadata: {
        source,
        timestamp,
        ...metadata
      }
    };
  }

  // Handle session-based responses (text from Gemini chat)
  if (source === 'session') {
    const text = response?.text || response?.response?.text || '';
    
    if (!text || text.trim().length === 0) {
      return {
        success: false,
        data: null,
        error: 'Sub-agent returned empty response',
        errorCode: 'EMPTY_SESSION_RESPONSE',
        metadata: {
          source,
          timestamp,
          ...metadata
        }
      };
    }

    return {
      success: true,
      data: {
        instructions: text.trim(),
        raw: response
      },
      metadata: {
        source,
        timestamp,
        ...metadata
      }
    };
  }

  // Handle direct tool responses
  if (source === 'direct') {
    // Check for success status
    if (response?.status === 'success' || response?.status === 'ok') {
      return {
        success: true,
        data: response.data || response.result || response,
        metadata: {
          source,
          timestamp,
          ...metadata
        }
      };
    }

    // If no explicit status, assume success if there's data
    if (response?.data || response?.result) {
      return {
        success: true,
        data: response.data || response.result,
        metadata: {
          source,
          timestamp,
          ...metadata
        }
      };
    }

    // If response has any content, treat as success
    if (response && Object.keys(response).length > 0) {
      return {
        success: true,
        data: response,
        metadata: {
          source,
          timestamp,
          ...metadata
        }
      };
    }
  }

  // Fallback: unknown response format
  return {
    success: false,
    data: null,
    error: 'Unable to normalize response: unknown format',
    errorCode: 'NORMALIZATION_FAILED',
    metadata: {
      source,
      timestamp,
      ...metadata
    }
  };
}

/**
 * Transforms a normalized response for the master agent
 * Formats the response in a way the master agent can easily consume
 * @param response - Normalized response
 * @returns Formatted response for master agent
 */
export function transformResponseForMaster(response: NormalizedResponse): any {
  if (!response.success) {
    return {
      error: response.error || 'Sub-agent request failed',
      errorCode: response.errorCode,
      message: response.error || 'An error occurred while processing your request'
    };
  }

  // For session-based responses, extract instructions
  if (response.metadata?.source === 'session' && response.data?.instructions) {
    return {
      instructions: response.data.instructions,
      data: response.data.raw
    };
  }

  // For direct tool responses, return the data directly
  return {
    result: response.data,
    success: true
  };
}

/**
 * Creates a timeout promise that rejects after specified milliseconds
 * @param ms - Milliseconds to wait before timeout
 * @param message - Error message for timeout
 * @returns Promise that rejects after timeout
 */
export function createTimeoutPromise(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(message));
    }, ms);
  });
}

/**
 * Executes a promise with timeout
 * @param promise - The promise to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param timeoutMessage - Message for timeout error
 * @returns Promise that resolves/rejects with timeout handling
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  return Promise.race([
    promise,
    createTimeoutPromise(timeoutMs, timeoutMessage)
  ]);
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  shouldRetry?: (error: any) => boolean;
}

/**
 * Executes a function with retry logic and exponential backoff
 * @param fn - Function to execute
 * @param config - Retry configuration
 * @returns Promise that resolves with the result or rejects after all retries
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  const { maxRetries, initialDelay, maxDelay, shouldRetry } = config;
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Check if we should retry this error
      if (shouldRetry && !shouldRetry(error)) {
        throw error;
      }
      
      // Don't retry on the last attempt
      if (attempt >= maxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(2, attempt),
        maxDelay
      );
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Determines if an error is retryable
 * @param error - The error to check
 * @returns True if the error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (!error) return false;
  
  const errorMessage = error.message || error.toString() || '';
  const errorCode = error.errorCode || '';
  
  // Retry on network errors, timeouts, and transient errors
  const retryablePatterns = [
    'timeout',
    'TIMEOUT',
    'network',
    'NETWORK',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'temporary',
    'TEMPORARY',
    'rate limit',
    'RATE_LIMIT',
    '503',
    '502',
    '504',
    'Content Union', // Gemini API format errors
    'ROUTING_ERROR', // Communication routing errors
    'AGENT_UNAVAILABLE' // Agent temporarily unavailable
  ];
  
  return retryablePatterns.some(pattern => 
    errorMessage.includes(pattern) || errorCode.includes(pattern)
  );
}

/**
 * Bidirectional error recovery context
 */
export interface BidirectionalErrorContext {
  from: string; // Source agent ID
  to: string; // Target agent ID
  messageType?: string; // Type of message that failed
  attemptCount: number; // Current attempt number
  maxAttempts: number; // Maximum attempts allowed
  lastError?: string; // Last error message
  context?: any; // Additional context
}

/**
 * Attempts to recover from a bidirectional communication error
 * @param error - The error that occurred
 * @param context - Error context for recovery
 * @returns Recovery action or null if recovery not possible
 */
export function attemptBidirectionalRecovery(
  error: any,
  context: BidirectionalErrorContext
): { action: 'retry' | 'fallback' | 'escalate' | 'abort'; delay?: number } | null {
  if (!error) return null;

  const errorMessage = error.message || error.toString() || '';
  const errorCode = error.errorCode || '';

  // Check if we've exceeded max attempts
  if (context.attemptCount >= context.maxAttempts) {
    return { action: 'abort' };
  }

  // Timeout errors - retry with exponential backoff
  if (errorMessage.includes('timeout') || errorCode.includes('TIMEOUT')) {
    const delay = Math.min(1000 * Math.pow(2, context.attemptCount), 10000);
    return { action: 'retry', delay };
  }

  // Network errors - retry
  if (errorMessage.includes('network') || errorCode.includes('NETWORK')) {
    const delay = Math.min(2000 * context.attemptCount, 8000);
    return { action: 'retry', delay };
  }

  // Content Union errors - retry once (format might be fixed)
  if (errorMessage.includes('Content Union')) {
    if (context.attemptCount === 1) {
      return { action: 'retry', delay: 500 };
    }
    return { action: 'fallback' }; // Use fallback format
  }

  // Routing errors - try fallback route
  if (errorCode === 'ROUTING_ERROR' || errorCode === 'TOOL_NOT_FOUND') {
    if (context.attemptCount < 2) {
      return { action: 'retry', delay: 1000 };
    }
    return { action: 'fallback' };
  }

  // Agent unavailable - escalate or retry
  if (errorCode === 'AGENT_UNAVAILABLE') {
    if (context.attemptCount < 3) {
      const delay = 2000 * context.attemptCount;
      return { action: 'retry', delay };
    }
    return { action: 'escalate' };
  }

  // Unknown errors - retry once, then abort
  if (context.attemptCount === 1) {
    return { action: 'retry', delay: 1000 };
  }

  return { action: 'abort' };
}

/**
 * Enhanced retry with bidirectional error recovery
 * @param fn - Function to execute
 * @param config - Retry configuration
 * @param errorContext - Bidirectional error context
 * @returns Promise that resolves with the result or rejects after all retries
 */
export async function withBidirectionalRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
  errorContext: BidirectionalErrorContext
): Promise<T> {
  const { maxRetries, initialDelay, maxDelay, shouldRetry } = config;
  let lastError: any;
  let attemptCount = 0;

  while (attemptCount <= maxRetries) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      errorContext.attemptCount = attemptCount + 1;
      errorContext.lastError = error.message || error.toString();

      // Check if we should retry this error
      if (shouldRetry && !shouldRetry(error)) {
        throw error;
      }

      // Attempt bidirectional recovery
      const recovery = attemptBidirectionalRecovery(error, errorContext);
      
      if (!recovery || recovery.action === 'abort') {
        break;
      }

      if (recovery.action === 'retry' && attemptCount < maxRetries) {
        const delay = recovery.delay || Math.min(
          initialDelay * Math.pow(2, attemptCount),
          maxDelay
        );
        await new Promise(resolve => setTimeout(resolve, delay));
        attemptCount++;
        continue;
      }

      // Fallback or escalate actions would be handled by caller
      if (recovery.action === 'fallback' || recovery.action === 'escalate') {
        throw new Error(`Recovery action required: ${recovery.action}. Original error: ${error.message}`);
      }

      // Don't retry on the last attempt
      if (attemptCount >= maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelay * Math.pow(2, attemptCount),
        maxDelay
      );

      await new Promise(resolve => setTimeout(resolve, delay));
      attemptCount++;
    }
  }

  throw lastError;
}


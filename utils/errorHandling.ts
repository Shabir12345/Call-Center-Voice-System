/**
 * Error Handling and Reliability
 * 
 * Comprehensive error handling system with error categories,
 * retry logic, timeout management, and fallback strategies.
 */

/**
 * Error code definitions
 */
export enum ErrorCode {
  // Input Validation Errors
  INVALID_INPUT = 'INVALID_INPUT',
  MISSING_REQUIRED_DATA = 'MISSING_REQUIRED_DATA',
  TYPE_MISMATCH = 'TYPE_MISMATCH',
  
  // External System Errors
  EXTERNAL_API_FAILURE = 'EXTERNAL_API_FAILURE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  CONNECTION_TIMEOUT = 'CONNECTION_TIMEOUT',
  
  // Timeout Errors
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  REQUEST_TIMEOUT = 'REQUEST_TIMEOUT',
  
  // Permission/Authentication Errors
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  
  // Internal Errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNEXPECTED_ERROR = 'UNEXPECTED_ERROR',
  PROCESSING_ERROR = 'PROCESSING_ERROR',
  
  // Business Logic Errors
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  RESERVATION_NOT_FOUND = 'RESERVATION_NOT_FOUND',
  BILLING_INFO_NOT_FOUND = 'BILLING_INFO_NOT_FOUND',
  
  // Rate Limiting
  RATE_LIMIT_ERROR = 'RATE_LIMIT_ERROR',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',
  
  // Tool/Agent Execution Errors
  TOOL_EXECUTOR_NOT_INITIALIZED = 'TOOL_EXECUTOR_NOT_INITIALIZED',
  TOOL_TIMEOUT = 'TOOL_TIMEOUT',
  TOOL_EXECUTION_ERROR = 'TOOL_EXECUTION_ERROR',
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_EXECUTION_FAILED = 'TOOL_EXECUTION_FAILED',
  MOCK_EXECUTION_ERROR = 'MOCK_EXECUTION_ERROR'
}

/**
 * Error category configuration
 */
export interface ErrorCategory {
  code: ErrorCode;
  retryable: boolean;
  userFriendlyMessage: string;
  suggestions?: string[];
  httpStatusCode?: number;
}

/**
 * Error categories mapping
 */
export const ERROR_CATEGORIES: Record<ErrorCode, ErrorCategory> = {
  // Input Validation Errors (Non-retryable)
  [ErrorCode.INVALID_INPUT]: {
    code: ErrorCode.INVALID_INPUT,
    retryable: false,
    userFriendlyMessage: 'The information provided is invalid. Please check and try again.',
    httpStatusCode: 400
  },
  [ErrorCode.MISSING_REQUIRED_DATA]: {
    code: ErrorCode.MISSING_REQUIRED_DATA,
    retryable: false,
    userFriendlyMessage: 'Some required information is missing. Please provide all necessary details.',
    httpStatusCode: 400
  },
  [ErrorCode.TYPE_MISMATCH]: {
    code: ErrorCode.TYPE_MISMATCH,
    retryable: false,
    userFriendlyMessage: 'The data format is incorrect. Please check your input.',
    httpStatusCode: 400
  },
  
  // External System Errors (Retryable)
  [ErrorCode.EXTERNAL_API_FAILURE]: {
    code: ErrorCode.EXTERNAL_API_FAILURE,
    retryable: true,
    userFriendlyMessage: "I'm having trouble accessing the system right now. Please try again in a moment.",
    suggestions: ['Wait a few seconds and try again', 'Check your internet connection'],
    httpStatusCode: 503
  },
  [ErrorCode.DATABASE_ERROR]: {
    code: ErrorCode.DATABASE_ERROR,
    retryable: true,
    userFriendlyMessage: 'The database is temporarily unavailable. Please try again.',
    httpStatusCode: 503
  },
  [ErrorCode.NETWORK_ERROR]: {
    code: ErrorCode.NETWORK_ERROR,
    retryable: true,
    userFriendlyMessage: 'A network error occurred. Please check your connection and try again.',
    httpStatusCode: 503
  },
  [ErrorCode.CONNECTION_TIMEOUT]: {
    code: ErrorCode.CONNECTION_TIMEOUT,
    retryable: true,
    userFriendlyMessage: 'The connection timed out. Please try again.',
    httpStatusCode: 504
  },
  
  // Timeout Errors (Retryable)
  [ErrorCode.TIMEOUT_ERROR]: {
    code: ErrorCode.TIMEOUT_ERROR,
    retryable: true,
    userFriendlyMessage: 'The request took too long to process. Please try again.',
    httpStatusCode: 504
  },
  [ErrorCode.REQUEST_TIMEOUT]: {
    code: ErrorCode.REQUEST_TIMEOUT,
    retryable: true,
    userFriendlyMessage: 'Your request timed out. Please try again.',
    httpStatusCode: 504
  },
  
  // Permission Errors (Non-retryable)
  [ErrorCode.UNAUTHORIZED]: {
    code: ErrorCode.UNAUTHORIZED,
    retryable: false,
    userFriendlyMessage: 'You are not authorized to perform this action.',
    httpStatusCode: 401
  },
  [ErrorCode.FORBIDDEN]: {
    code: ErrorCode.FORBIDDEN,
    retryable: false,
    userFriendlyMessage: 'You do not have permission to access this resource.',
    httpStatusCode: 403
  },
  [ErrorCode.PERMISSION_DENIED]: {
    code: ErrorCode.PERMISSION_DENIED,
    retryable: false,
    userFriendlyMessage: 'Permission denied. Please contact support if you believe this is an error.',
    httpStatusCode: 403
  },
  
  // Internal Errors (May be retryable)
  [ErrorCode.INTERNAL_ERROR]: {
    code: ErrorCode.INTERNAL_ERROR,
    retryable: false,
    userFriendlyMessage: 'An internal error occurred. Please try again or contact support.',
    httpStatusCode: 500
  },
  [ErrorCode.UNEXPECTED_ERROR]: {
    code: ErrorCode.UNEXPECTED_ERROR,
    retryable: false,
    userFriendlyMessage: 'An unexpected error occurred. Please try again.',
    httpStatusCode: 500
  },
  [ErrorCode.PROCESSING_ERROR]: {
    code: ErrorCode.PROCESSING_ERROR,
    retryable: true,
    userFriendlyMessage: 'There was an error processing your request. Please try again.',
    httpStatusCode: 500
  },
  
  // Business Logic Errors (Non-retryable)
  [ErrorCode.BUSINESS_RULE_VIOLATION]: {
    code: ErrorCode.BUSINESS_RULE_VIOLATION,
    retryable: false,
    userFriendlyMessage: 'This action cannot be completed due to business rules.',
    httpStatusCode: 400
  },
  [ErrorCode.RESERVATION_NOT_FOUND]: {
    code: ErrorCode.RESERVATION_NOT_FOUND,
    retryable: false,
    userFriendlyMessage: "I couldn't find a reservation with those details. Please verify your reservation number and name.",
    suggestions: ['Check your reservation number', 'Verify the name matches exactly'],
    httpStatusCode: 404
  },
  [ErrorCode.BILLING_INFO_NOT_FOUND]: {
    code: ErrorCode.BILLING_INFO_NOT_FOUND,
    retryable: false,
    userFriendlyMessage: 'No billing information found for the specified period.',
    httpStatusCode: 404
  },
  
  // Rate Limiting (Retryable with delay)
  [ErrorCode.RATE_LIMIT_ERROR]: {
    code: ErrorCode.RATE_LIMIT_ERROR,
    retryable: true,
    userFriendlyMessage: 'Too many requests. Please wait a moment and try again.',
    httpStatusCode: 429
  },
  [ErrorCode.TOO_MANY_REQUESTS]: {
    code: ErrorCode.TOO_MANY_REQUESTS,
    retryable: true,
    userFriendlyMessage: 'Rate limit exceeded. Please wait before trying again.',
    httpStatusCode: 429
  },
  
  // Tool/Agent Execution Errors
  [ErrorCode.TOOL_EXECUTOR_NOT_INITIALIZED]: {
    code: ErrorCode.TOOL_EXECUTOR_NOT_INITIALIZED,
    retryable: false,
    userFriendlyMessage: 'The tool system is not properly initialized. Please refresh the page and try again.',
    httpStatusCode: 500
  },
  [ErrorCode.TOOL_TIMEOUT]: {
    code: ErrorCode.TOOL_TIMEOUT,
    retryable: true,
    userFriendlyMessage: 'The tool took too long to respond. Please try again with a simpler request.',
    httpStatusCode: 504
  },
  [ErrorCode.TOOL_EXECUTION_ERROR]: {
    code: ErrorCode.TOOL_EXECUTION_ERROR,
    retryable: true,
    userFriendlyMessage: 'There was an error executing the tool. Please try again.',
    httpStatusCode: 500
  },
  [ErrorCode.TOOL_NOT_FOUND]: {
    code: ErrorCode.TOOL_NOT_FOUND,
    retryable: false,
    userFriendlyMessage: 'The requested tool could not be found.',
    httpStatusCode: 404
  },
  [ErrorCode.TOOL_EXECUTION_FAILED]: {
    code: ErrorCode.TOOL_EXECUTION_FAILED,
    retryable: true,
    userFriendlyMessage: 'Tool execution failed. Please try again.',
    httpStatusCode: 500
  },
  [ErrorCode.MOCK_EXECUTION_ERROR]: {
    code: ErrorCode.MOCK_EXECUTION_ERROR,
    retryable: false,
    userFriendlyMessage: 'There was an error with the mock integration. Please check the configuration.',
    httpStatusCode: 500
  }
};

/**
 * Error response structure
 */
export interface ErrorResponse {
  code: ErrorCode | string;
  message: string;
  details?: any;
  retryable: boolean;
  userFriendlyMessage?: string;
  suggestions?: string[];
}

/**
 * Create error response (sanitized for user display)
 */
export function createErrorResponse(
  code: ErrorCode | string,
  message?: string,
  details?: any
): ErrorResponse {
  const category = ERROR_CATEGORIES[code as ErrorCode];
  
  // Sanitize error message to prevent information leakage
  let sanitizedMessage = message;
  if (message && typeof window !== 'undefined') {
    try {
      // Synchronous sanitization - remove stack traces and file paths
      sanitizedMessage = message
        .split('\n')
        .filter(line => {
          // Keep lines that don't look like stack traces
          return !line.match(/^\s*at\s+/) && 
                 !line.match(/^\s*\d+\|/) &&
                 !line.includes('node_modules') &&
                 !line.includes('.ts:') &&
                 !line.includes('.js:');
        })
        .join('\n')
        .replace(/\/[^\s]+\.(ts|js):\d+:\d+/g, '')
        .replace(/C:\\[^\s]+/g, '')
        .trim();
      
      // If message is empty or too technical, use generic message
      if (!sanitizedMessage || sanitizedMessage.length < 10) {
        sanitizedMessage = undefined;
      }
    } catch (e) {
      // If sanitization fails, use original message
      console.warn('Error sanitization failed:', e);
    }
  }
  
  if (category) {
    return {
      code,
      message: sanitizedMessage || category.userFriendlyMessage,
      details: sanitizeErrorDetails(details), // Sanitize details too
      retryable: category.retryable,
      userFriendlyMessage: category.userFriendlyMessage,
      suggestions: category.suggestions
    };
  }

  // Unknown error code
  return {
    code,
    message: sanitizedMessage || 'An error occurred',
    details: sanitizeErrorDetails(details),
    retryable: false
  };
}

/**
 * Sanitize error details to remove sensitive information
 */
function sanitizeErrorDetails(details: any): any {
  if (!details) {
    return details;
  }

  // Remove stack traces and file paths from details
  if (typeof details === 'string') {
    // Remove internal patterns
    return details
      .replace(/at\s+\w+\.\w+\s*\([^)]+\)/g, '')
      .replace(/\/[^\s]+\.(ts|js):\d+:\d+/g, '')
      .trim();
  }

  if (typeof details === 'object') {
    const sanitized: any = {};
    for (const key in details) {
      if (key === 'stack' || key === 'stackTrace' || key === 'file' || key === 'path') {
        // Skip internal details
        continue;
      }
      sanitized[key] = sanitizeErrorDetails(details[key]);
    }
    return sanitized;
  }

  return details;
}

/**
 * Get user-friendly error message
 */
export function getUserFriendlyErrorMessage(code: ErrorCode | string): string {
  const category = ERROR_CATEGORIES[code as ErrorCode];
  return category?.userFriendlyMessage || 'An error occurred. Please try again.';
}

/**
 * Check if error is retryable
 */
export function isRetryableError(code: ErrorCode | string): boolean {
  const category = ERROR_CATEGORIES[code as ErrorCode];
  return category?.retryable || false;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors: ErrorCode[];
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 2,
  initialDelayMs: 1000,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  retryableErrors: [
    ErrorCode.EXTERNAL_API_FAILURE,
    ErrorCode.NETWORK_ERROR,
    ErrorCode.TIMEOUT_ERROR,
    ErrorCode.RATE_LIMIT_ERROR,
    ErrorCode.DATABASE_ERROR,
    ErrorCode.CONNECTION_TIMEOUT
  ]
};

/**
 * Calculate retry delay with exponential backoff
 */
export function calculateRetryDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
  return Math.min(delay, config.maxDelayMs);
}

/**
 * Determine if error should be retried
 */
export function shouldRetry(
  errorCode: ErrorCode | string,
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): boolean {
  if (attempt >= config.maxRetries) {
    return false;
  }

  // Check if error is in retryable list
  if (config.retryableErrors.includes(errorCode as ErrorCode)) {
    return true;
  }

  // Check error category
  return isRetryableError(errorCode);
}

/**
 * Timeout configuration
 */
export interface TimeoutConfig {
  default: number;
  fastAgent: number;
  complexAgent: number;
  externalApi: number;
  databaseQuery: number;
}

/**
 * Default timeout configuration (in milliseconds)
 */
export const DEFAULT_TIMEOUT_CONFIG: TimeoutConfig = {
  default: 30000,        // 30 seconds
  fastAgent: 10000,      // 10 seconds (for simple queries)
  complexAgent: 60000,   // 60 seconds (for complex operations)
  externalApi: 15000,    // 15 seconds
  databaseQuery: 10000   // 10 seconds
};

/**
 * Get timeout for task and agent type
 */
export function getTimeoutForTask(
  task: string,
  agentType?: string
): number {
  // Task-specific timeouts
  if (['simple_query', 'get_status', 'check_availability'].includes(task)) {
    return DEFAULT_TIMEOUT_CONFIG.fastAgent;
  }

  if (['complex_calculation', 'generate_report', 'process_batch'].includes(task)) {
    return DEFAULT_TIMEOUT_CONFIG.complexAgent;
  }

  // Agent-specific timeouts
  if (agentType === 'data_retrieval') {
    return DEFAULT_TIMEOUT_CONFIG.databaseQuery;
  }

  if (agentType === 'external_integration') {
    return DEFAULT_TIMEOUT_CONFIG.externalApi;
  }

  return DEFAULT_TIMEOUT_CONFIG.default;
}

/**
 * Fallback strategy types
 */
export type FallbackStrategy = 
  | 'cached_data'
  | 'alternative_agent'
  | 'degraded_mode'
  | 'human_escalation'
  | 'abort';

/**
 * Fallback configuration
 */
export interface FallbackConfig {
  strategies: FallbackStrategy[];
  cacheEnabled: boolean;
  alternativeAgents?: Record<string, string>; // task -> alternative agent ID
  humanEscalationEnabled: boolean;
}

/**
 * Execute with fallback chain
 */
export async function executeWithFallback<T>(
  primaryAction: () => Promise<T>,
  fallbackActions: Array<{
    strategy: FallbackStrategy;
    action: () => Promise<T | null>;
  }>,
  onError?: (error: any, strategy: FallbackStrategy) => void
): Promise<T | null> {
  try {
    return await primaryAction();
  } catch (error) {
    if (onError) {
      onError(error, 'primary');
    }

    // Try fallback strategies in order
    for (const fallback of fallbackActions) {
      try {
        const result = await fallback.action();
        if (result !== null) {
          return result;
        }
      } catch (fallbackError) {
        if (onError) {
          onError(fallbackError, fallback.strategy);
        }
        continue;
      }
    }

    // All fallbacks exhausted
    return null;
  }
}


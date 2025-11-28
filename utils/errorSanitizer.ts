/**
 * Error Sanitizer
 * 
 * Sanitizes error messages to prevent information leakage.
 * Removes stack traces, internal paths, and sensitive data from user-facing errors.
 */

export interface SanitizedError {
  message: string;
  code?: string;
  userFriendly?: boolean;
  originalError?: any; // Keep for logging, but don't expose
}

/**
 * Patterns that indicate internal/system information
 */
const INTERNAL_PATTERNS = [
  /at\s+\w+\.\w+\s*\([^)]+\)/g,           // Stack trace lines
  /at\s+[^\s]+\s*\([^)]+\)/g,              // Function calls in stack
  /\/[^\s]+\.(ts|js|tsx|jsx):\d+:\d+/g,    // File paths with line numbers
  /C:\\[^\s]+/g,                           // Windows paths
  /\/[^\s]+\/node_modules\/[^\s]+/g,       // Node modules paths
  /Error:\s*[^\n]+/g,                      // Error: prefix with details
];

/**
 * Sensitive data patterns
 */
const SENSITIVE_PATTERNS = [
  /api[_-]?key\s*[:=]\s*['"]?[^\s'"]+/gi,  // API keys
  /password\s*[:=]\s*['"]?[^\s'"]+/gi,     // Passwords
  /token\s*[:=]\s*['"]?[^\s'"]+/gi,        // Tokens
  /secret\s*[:=]\s*['"]?[^\s'"]+/gi,      // Secrets
  /database\s*[:=]\s*['"]?[^\s'"]+/gi,    // Database info
];

/**
 * Sanitize error message for user display
 */
export function sanitizeErrorMessage(error: any, includeCode: boolean = false): string {
  if (!error) {
    return 'An error occurred. Please try again.';
  }

  let message = '';

  // Extract message
  if (typeof error === 'string') {
    message = error;
  } else if (error.message) {
    message = error.message;
  } else if (error.toString) {
    message = error.toString();
  } else {
    return 'An error occurred. Please try again.';
  }

  // Remove stack traces
  message = removeStackTraces(message);

  // Remove file paths
  message = removeFilePaths(message);

  // Remove sensitive data
  message = removeSensitiveData(message);

  // Remove internal patterns
  for (const pattern of INTERNAL_PATTERNS) {
    message = message.replace(pattern, '');
  }

  // Clean up extra whitespace
  message = message.replace(/\s+/g, ' ').trim();

  // If message is empty or too technical, use generic message
  if (!message || message.length < 10 || isTechnicalMessage(message)) {
    return 'An error occurred. Please try again.';
  }

  // Add error code if requested and available
  if (includeCode && error.code) {
    return `${message} (Error code: ${error.code})`;
  }

  return message;
}

/**
 * Remove stack traces from error message
 */
function removeStackTraces(message: string): string {
  // Remove common stack trace patterns
  return message
    .split('\n')
    .filter(line => {
      // Keep lines that don't look like stack traces
      return !line.match(/^\s*at\s+/) && 
             !line.match(/^\s*\d+\|/) &&
             !line.includes('node_modules') &&
             !line.includes('.ts:') &&
             !line.includes('.js:');
    })
    .join('\n');
}

/**
 * Remove file paths from error message
 */
function removeFilePaths(message: string): string {
  // Remove file paths
  return message
    .replace(/\/[^\s]+\.(ts|js|tsx|jsx):\d+:\d+/g, '')
    .replace(/C:\\[^\s]+/g, '')
    .replace(/\/[^\s]+\/node_modules\/[^\s]+/g, '')
    .replace(/file:\/\/\/[^\s]+/g, '');
}

/**
 * Remove sensitive data from error message
 */
function removeSensitiveData(message: string): string {
  let sanitized = message;

  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match) => {
      // Replace with generic placeholder
      if (match.toLowerCase().includes('api')) return 'API key: [REDACTED]';
      if (match.toLowerCase().includes('password')) return 'password: [REDACTED]';
      if (match.toLowerCase().includes('token')) return 'token: [REDACTED]';
      if (match.toLowerCase().includes('secret')) return 'secret: [REDACTED]';
      return '[REDACTED]';
    });
  }

  return sanitized;
}

/**
 * Check if message is too technical for users
 */
function isTechnicalMessage(message: string): boolean {
  const technicalKeywords = [
    'stack trace',
    'stackoverflow',
    'undefined',
    'null reference',
    'typeerror',
    'referenceerror',
    'syntaxerror',
    'cannot read property',
    'is not a function',
    'module not found',
    'require is not defined',
  ];

  const lowerMessage = message.toLowerCase();
  return technicalKeywords.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Create sanitized error response
 */
export function createSanitizedErrorResponse(
  error: any,
  userFriendlyMessage?: string
): SanitizedError {
  const sanitizedMessage = userFriendlyMessage || sanitizeErrorMessage(error);

  return {
    message: sanitizedMessage,
    code: error?.code || error?.errorCode,
    userFriendly: true,
    originalError: error // Keep for server-side logging
  };
}

/**
 * Log error with full details (for server-side only)
 */
export function logErrorWithDetails(error: any, context?: any): void {
  // This should only be called server-side or in development
  if (process.env.NODE_ENV === 'production' && typeof window !== 'undefined') {
    // Don't log full errors in production client
    console.error('An error occurred');
    return;
  }

  // Log full error details for debugging
  console.error('Error details:', {
    message: error?.message,
    stack: error?.stack,
    code: error?.code,
    context
  });
}

/**
 * Check if error contains sensitive information
 */
export function containsSensitiveInfo(error: any): boolean {
  const errorString = JSON.stringify(error);
  
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(errorString)) {
      return true;
    }
  }

  return false;
}


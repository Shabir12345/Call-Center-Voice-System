/**
 * Input Sanitizer
 * 
 * Sanitizes user inputs to prevent XSS attacks and injection vulnerabilities.
 */

/**
 * Sanitize HTML content to prevent XSS
 * Removes dangerous HTML tags and attributes
 */
export function sanitizeHtml(html: string): string {
  if (typeof html !== 'string') {
    return '';
  }

  // Create a temporary div element
  const div = document.createElement('div');
  div.textContent = html; // This automatically escapes HTML
  
  // Get the escaped content
  return div.innerHTML;
}

/**
 * Sanitize string input (removes HTML tags)
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove HTML tags
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Remove potentially dangerous characters from input
 */
export function sanitizeForStorage(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove control characters except newlines and tabs
  return input.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Validate and sanitize email
 */
export function sanitizeEmail(email: string): string | null {
  if (typeof email !== 'string') {
    return null;
  }

  // Basic email validation and sanitization
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const trimmed = email.trim().toLowerCase();
  
  if (emailRegex.test(trimmed)) {
    return sanitizeString(trimmed);
  }

  return null;
}

/**
 * Validate and sanitize URL
 */
export function sanitizeUrl(url: string): string | null {
  if (typeof url !== 'string') {
    return null;
  }

  try {
    const parsed = new URL(url);
    // Only allow http and https protocols
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch (e) {
    return null;
  }
}

/**
 * Remove SQL injection patterns (basic)
 */
export function sanitizeForSQL(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Remove common SQL injection patterns
  return input
    .replace(/['";]/g, '') // Remove quotes and semicolons
    .replace(/--/g, '')     // Remove SQL comments
    .replace(/\/\*/g, '')   // Remove block comment start
    .replace(/\*\//g, '');  // Remove block comment end
}

/**
 * Sanitize for JSON (prevent JSON injection)
 */
export function sanitizeForJSON(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  // Escape special JSON characters
  return input
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Check if string contains potentially dangerous content
 */
export function containsDangerousContent(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }

  // Check for script tags
  if (/<script[\s\S]*?>[\s\S]*?<\/script>/gi.test(input)) {
    return true;
  }

  // Check for javascript: protocol
  if (/javascript:/gi.test(input)) {
    return true;
  }

  // Check for on* event handlers
  if (/on\w+\s*=/gi.test(input)) {
    return true;
  }

  // Check for iframe tags
  if (/<iframe[\s\S]*?>/gi.test(input)) {
    return true;
  }

  return false;
}

/**
 * Comprehensive input sanitization
 */
export function sanitizeInput(input: any, options: {
  allowHtml?: boolean;
  maxLength?: number;
  removeNewlines?: boolean;
} = {}): any {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === 'string') {
    let sanitized = input;

    // Check for dangerous content
    if (containsDangerousContent(sanitized)) {
      sanitized = sanitizeString(sanitized);
    }

    // Apply length limit
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    // Remove newlines if requested
    if (options.removeNewlines) {
      sanitized = sanitized.replace(/\n/g, ' ').replace(/\r/g, '');
    }

    // Sanitize HTML unless explicitly allowed
    if (!options.allowHtml) {
      sanitized = sanitizeString(sanitized);
    }

    return sanitized;
  }

  // Recursively sanitize objects and arrays
  return sanitizeObject(input);
}


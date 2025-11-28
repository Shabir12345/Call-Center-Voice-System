/**
 * Security Headers
 * 
 * Utilities for enforcing HTTPS and security headers in production.
 */

/**
 * Check if we're in a secure context (HTTPS)
 */
export function isSecureContext(): boolean {
  if (typeof window === 'undefined') {
    // Server-side: assume secure if in production
    return process.env.NODE_ENV === 'production';
  }

  // Browser: check if using HTTPS
  return window.location.protocol === 'https:' || 
         window.location.hostname === 'localhost' ||
         window.location.hostname === '127.0.0.1';
}

/**
 * Enforce HTTPS - redirect if not secure
 */
export function enforceHTTPS(): void {
  if (typeof window === 'undefined') {
    return;
  }

  // Only enforce in production
  if (process.env.NODE_ENV !== 'production') {
    return;
  }

  // Check if we're on HTTPS
  if (!isSecureContext()) {
    const httpsUrl = window.location.href.replace(/^http:/, 'https:');
    console.warn('Redirecting to HTTPS:', httpsUrl);
    window.location.replace(httpsUrl);
  }
}

/**
 * Get security headers for server responses
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
  };
}

/**
 * Validate security configuration
 */
export function validateSecurityConfig(): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  // Check HTTPS in production
  if (process.env.NODE_ENV === 'production' && !isSecureContext()) {
    issues.push('⚠️  Not using HTTPS in production!');
  }

  // Check if API keys are in client code (basic check)
  if (typeof window !== 'undefined') {
    // This is a basic check - full check should be done at build time
    const scripts = document.querySelectorAll('script');
    scripts.forEach(script => {
      if (script.textContent && script.textContent.includes('GEMINI_API_KEY')) {
        issues.push('⚠️  Potential API key exposure detected in script tags');
      }
    });
  }

  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Initialize security checks
 */
export function initializeSecurity(): void {
  // Enforce HTTPS in production
  if (typeof window !== 'undefined') {
    enforceHTTPS();

    // Log security status
    const config = validateSecurityConfig();
    if (!config.valid) {
      console.warn('Security configuration issues:', config.issues);
    }
  }
}


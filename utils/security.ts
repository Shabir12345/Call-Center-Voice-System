/**
 * Security Utilities
 * 
 * Security-related utilities for authentication, authorization,
 * input sanitization, and security auditing
 */

import { CentralLogger } from './logger';

/**
 * Security audit result
 */
export interface SecurityAuditResult {
  passed: boolean;
  issues: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical';
    category: string;
    description: string;
    recommendation: string;
  }>;
}

/**
 * Security Manager
 */
export class SecurityManager {
  private logger: CentralLogger;
  private bannedPatterns: RegExp[] = [];
  private allowedOrigins: string[] = [];

  constructor(logger: CentralLogger) {
    this.logger = logger;
    this.initializeBannedPatterns();
  }

  /**
   * Initialize banned patterns (SQL injection, XSS, etc.)
   */
  private initializeBannedPatterns(): void {
    // SQL Injection patterns
    this.bannedPatterns.push(
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE)\b)/i,
      /('|(\\')|(;)|(\\)|(\/\*)|(\*\/)|(--)|(\+)|(\|)|(\&))/i
    );

    // XSS patterns
    this.bannedPatterns.push(
      /<script[^>]*>.*?<\/script>/gi,
      /javascript:/i,
      /on\w+\s*=/i
    );

    // Command injection
    this.bannedPatterns.push(
      /[;&|`$(){}[\]]/,
      /\b(cat|ls|pwd|cd|rm|mv|cp|chmod|chown)\b/i
    );
  }

  /**
   * Sanitize input
   */
  sanitizeInput(input: string): string {
    // Remove null bytes
    let sanitized = input.replace(/\0/g, '');
    
    // Trim whitespace
    sanitized = sanitized.trim();
    
    // Escape HTML
    sanitized = sanitized
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');

    return sanitized;
  }

  /**
   * Validate input for security issues
   */
  validateInputSecurity(input: string): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    for (const pattern of this.bannedPatterns) {
      if (pattern.test(input)) {
        issues.push(`Potential security issue detected: ${pattern.toString()}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues
    };
  }

  /**
   * Check if origin is allowed
   */
  isOriginAllowed(origin: string): boolean {
    if (this.allowedOrigins.length === 0) {
      return true; // Allow all if none specified
    }
    return this.allowedOrigins.includes(origin);
  }

  /**
   * Add allowed origin
   */
  addAllowedOrigin(origin: string): void {
    if (!this.allowedOrigins.includes(origin)) {
      this.allowedOrigins.push(origin);
    }
  }

  /**
   * Perform security audit
   */
  async performSecurityAudit(config: {
    hasAuthentication?: boolean;
    hasEncryption?: boolean;
    hasInputValidation?: boolean;
    hasRateLimiting?: boolean;
    hasLogging?: boolean;
  }): Promise<SecurityAuditResult> {
    const issues: SecurityAuditResult['issues'] = [];

    if (!config.hasAuthentication) {
      issues.push({
        severity: 'critical',
        category: 'Authentication',
        description: 'No authentication mechanism configured',
        recommendation: 'Implement authentication for all sensitive operations'
      });
    }

    if (!config.hasEncryption) {
      issues.push({
        severity: 'high',
        category: 'Encryption',
        description: 'No encryption configured for sensitive data',
        recommendation: 'Enable encryption for data at rest and in transit'
      });
    }

    if (!config.hasInputValidation) {
      issues.push({
        severity: 'high',
        category: 'Input Validation',
        description: 'Input validation not fully implemented',
        recommendation: 'Implement comprehensive input validation'
      });
    }

    if (!config.hasRateLimiting) {
      issues.push({
        severity: 'medium',
        category: 'Rate Limiting',
        description: 'No rate limiting configured',
        recommendation: 'Implement rate limiting to prevent abuse'
      });
    }

    if (!config.hasLogging) {
      issues.push({
        severity: 'medium',
        category: 'Logging',
        description: 'Security logging not configured',
        recommendation: 'Enable security event logging'
      });
    }

    return {
      passed: issues.filter(i => i.severity === 'critical' || i.severity === 'high').length === 0,
      issues
    };
  }

  /**
   * Hash sensitive data (placeholder - use proper crypto in production)
   */
  hashSensitiveData(data: string): string {
    // In production, use proper hashing (bcrypt, argon2, etc.)
    // This is a placeholder
    return btoa(data).split('').reverse().join('');
  }

  /**
   * Generate secure token
   */
  generateSecureToken(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      token += chars[array[i] % chars.length];
    }
    return token;
  }
}


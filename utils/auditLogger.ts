/**
 * Audit Logger
 * 
 * Logs security events and sensitive operations for compliance and security monitoring.
 * Separate from regular application logging.
 */

import { CentralLogger } from './logger';

export type AuditEventType = 
  | 'authentication'
  | 'authorization'
  | 'data_access'
  | 'data_modification'
  | 'configuration_change'
  | 'security_event'
  | 'api_access'
  | 'session_creation'
  | 'session_destruction'
  | 'error_occurred';

export interface AuditLogEntry {
  id: string;
  timestamp: number;
  eventType: AuditEventType;
  userId?: string;
  sessionId?: string;
  action: string;
  resource?: string;
  result: 'success' | 'failure' | 'denied';
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogQuery {
  eventType?: AuditEventType;
  userId?: string;
  sessionId?: string;
  startTime?: number;
  endTime?: number;
  result?: 'success' | 'failure' | 'denied';
  resource?: string;
}

/**
 * Audit Logger class
 */
export class AuditLogger {
  private logger: CentralLogger;
  private logs: AuditLogEntry[] = [];
  private maxLogs: number = 10000;

  constructor(logger?: CentralLogger) {
    this.logger = logger || new CentralLogger('info');
  }

  /**
   * Log an audit event
   */
  log(event: {
    eventType: AuditEventType;
    userId?: string;
    sessionId?: string;
    action: string;
    resource?: string;
    result: 'success' | 'failure' | 'denied';
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }): void {
    const auditEntry: AuditLogEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: Date.now(),
      eventType: event.eventType,
      userId: event.userId,
      sessionId: event.sessionId,
      action: event.action,
      resource: event.resource,
      result: event.result,
      details: this.sanitizeDetails(event.details),
      ipAddress: event.ipAddress,
      userAgent: event.userAgent
    };

    // Store in memory
    this.logs.push(auditEntry);
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Log to central logger with audit prefix
    this.logger.log({
      id: auditEntry.id,
      timestamp: auditEntry.timestamp,
      sessionId: auditEntry.sessionId,
      type: 'system',
      from: 'audit_logger',
      to: 'system',
      message: `[AUDIT] ${event.eventType}: ${event.action} - ${event.result}`,
      level: event.result === 'failure' || event.result === 'denied' ? 'warn' : 'info',
      metadata: {
        auditEvent: auditEntry
      }
    });
  }

  /**
   * Sanitize details to remove sensitive information
   */
  private sanitizeDetails(details?: Record<string, any>): Record<string, any> | undefined {
    if (!details) {
      return details;
    }

    const sanitized: Record<string, any> = {};
    const sensitiveKeys = ['password', 'apiKey', 'api_key', 'token', 'secret', 'auth', 'authorization'];

    for (const key in details) {
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = details[key];
      }
    }

    return sanitized;
  }

  /**
   * Query audit logs
   */
  query(filters: AuditLogQuery): AuditLogEntry[] {
    let results = [...this.logs];

    if (filters.eventType) {
      results = results.filter(log => log.eventType === filters.eventType);
    }

    if (filters.userId) {
      results = results.filter(log => log.userId === filters.userId);
    }

    if (filters.sessionId) {
      results = results.filter(log => log.sessionId === filters.sessionId);
    }

    if (filters.startTime) {
      results = results.filter(log => log.timestamp >= filters.startTime!);
    }

    if (filters.endTime) {
      results = results.filter(log => log.timestamp <= filters.endTime!);
    }

    if (filters.result) {
      results = results.filter(log => log.result === filters.result);
    }

    if (filters.resource) {
      results = results.filter(log => log.resource === filters.resource);
    }

    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get audit logs for a specific user
   */
  getUserAuditLogs(userId: string, limit: number = 100): AuditLogEntry[] {
    return this.query({ userId }).slice(0, limit);
  }

  /**
   * Get failed authentication attempts
   */
  getFailedAuthAttempts(startTime?: number): AuditLogEntry[] {
    return this.query({
      eventType: 'authentication',
      result: 'failure',
      startTime
    });
  }

  /**
   * Get security events
   */
  getSecurityEvents(startTime?: number): AuditLogEntry[] {
    return this.query({
      eventType: 'security_event',
      startTime
    });
  }

  /**
   * Export audit logs (for compliance)
   */
  export(startTime?: number, endTime?: number): AuditLogEntry[] {
    return this.query({ startTime, endTime });
  }

  /**
   * Clear old audit logs
   */
  clearOldLogs(olderThan: number): number {
    const cutoff = Date.now() - olderThan;
    const before = this.logs.length;
    this.logs = this.logs.filter(log => log.timestamp >= cutoff);
    return before - this.logs.length;
  }
}

/**
 * Global audit logger instance
 */
export const globalAuditLogger = new AuditLogger();

/**
 * Helper functions for common audit events
 */
export const auditLog = {
  /**
   * Log authentication event
   */
  authentication: (userId: string, result: 'success' | 'failure', details?: Record<string, any>) => {
    globalAuditLogger.log({
      eventType: 'authentication',
      userId,
      action: 'user_authentication',
      result,
      details
    });
  },

  /**
   * Log data access
   */
  dataAccess: (userId: string, resource: string, action: string, result: 'success' | 'failure' | 'denied') => {
    globalAuditLogger.log({
      eventType: 'data_access',
      userId,
      action,
      resource,
      result
    });
  },

  /**
   * Log data modification
   */
  dataModification: (userId: string, resource: string, action: string, result: 'success' | 'failure' | 'denied') => {
    globalAuditLogger.log({
      eventType: 'data_modification',
      userId,
      action,
      resource,
      result
    });
  },

  /**
   * Log security event
   */
  securityEvent: (action: string, result: 'success' | 'failure' | 'denied', details?: Record<string, any>) => {
    globalAuditLogger.log({
      eventType: 'security_event',
      action,
      result,
      details
    });
  },

  /**
   * Log API access
   */
  apiAccess: (endpoint: string, result: 'success' | 'failure' | 'denied', userId?: string) => {
    globalAuditLogger.log({
      eventType: 'api_access',
      userId,
      action: 'api_call',
      resource: endpoint,
      result
    });
  },

  /**
   * Log session creation/destruction
   */
  session: (action: 'created' | 'destroyed', sessionId: string, userId?: string) => {
    globalAuditLogger.log({
      eventType: action === 'created' ? 'session_creation' : 'session_destruction',
      userId,
      sessionId,
      action: `session_${action}`,
      result: 'success'
    });
  }
};


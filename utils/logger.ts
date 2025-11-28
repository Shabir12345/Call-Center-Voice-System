/**
 * Central Logger
 * 
 * Comprehensive logging and auditing system for all agent interactions.
 * Supports multiple log levels and querying capabilities.
 */

/**
 * Log entry structure
 */
export interface LogEntry {
  id: string;
  timestamp: number;
  sessionId?: string;
  type: 'agent_to_agent' | 'caller_to_agent' | 'agent_to_caller' | 'system' | 'error' | 'debug';
  from: string;
  to: string;
  message: string;
  level?: LogLevel; // Log level for filtering
  metadata?: {
    messageId?: string;
    threadId?: string;
    duration?: number;
    success?: boolean;
    error?: string | null;
    errorCode?: string;
    [key: string]: any;
  };
}

/**
 * Log level type
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Persistent storage interface for logs
 */
export interface LogStorage {
  saveLog(log: LogEntry): Promise<void>;
  queryLogs(filters: LogQueryFilters): Promise<LogEntry[]>;
  clearLogs(olderThan?: number): Promise<number>;
}

/**
 * Log query filters
 */
export interface LogQueryFilters {
  sessionId?: string;
  agentId?: string;
  startTime?: number;
  endTime?: number;
  // Internal field names
  logType?: LogEntry['type'];
  logLevel?: LogLevel;
  from?: string;
  to?: string;
  // Friendly aliases used in tests
  level?: LogLevel;
  type?: LogEntry['type'];
}

/**
 * In-memory log storage
 */
class InMemoryLogStorage implements LogStorage {
  private logs: LogEntry[] = [];
  private maxLogs: number;

  constructor(maxLogs: number = 10000) {
    this.maxLogs = maxLogs;
  }

  async saveLog(log: LogEntry): Promise<void> {
    this.logs.push(log);
    
    // Limit log size (keep last N logs)
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
  }

  async queryLogs(filters: LogQueryFilters): Promise<LogEntry[]> {
    let results = [...this.logs];

    if (filters.sessionId) {
      results = results.filter(l => l.sessionId === filters.sessionId);
    }

    if (filters.agentId) {
      results = results.filter(l => l.from === filters.agentId || l.to === filters.agentId);
    }

    if (filters.startTime) {
      results = results.filter(l => l.timestamp >= filters.startTime!);
    }

    if (filters.endTime) {
      results = results.filter(l => l.timestamp <= filters.endTime!);
    }

    if (filters.logType || filters.type) {
      const typeFilter = filters.logType || filters.type;
      results = results.filter(l => l.type === typeFilter);
    }

    if (filters.level || filters.logLevel) {
      const levelFilter = filters.level || filters.logLevel;
      results = results.filter(l => l.level === levelFilter);
    }

    if (filters.from) {
      results = results.filter(l => l.from === filters.from);
    }

    if (filters.to) {
      results = results.filter(l => l.to === filters.to);
    }

    // Sort by timestamp (oldest first)
    return results.sort((a, b) => a.timestamp - b.timestamp);
  }

  async clearLogs(olderThan?: number): Promise<number> {
    if (olderThan) {
      const before = this.logs.length;
      this.logs = this.logs.filter(l => l.timestamp >= olderThan);
      return before - this.logs.length;
    } else {
      const count = this.logs.length;
      this.logs = [];
      return count;
    }
  }

  getAllLogs(): LogEntry[] {
    return [...this.logs];
  }
}

/**
 * Central Logger for comprehensive logging
 */
export class CentralLogger {
  private logs: LogEntry[] = [];
  private maxLogs: number;
  private logLevel: LogLevel;
  private storage: LogStorage;
  private eventCallbacks: Map<string, ((entry: LogEntry) => void)[]> = new Map();

  constructor(
    // NOTE: Older tests sometimes call `new CentralLogger('in-memory', { logLevel: 'debug' })`
    // so we support both `(logLevel)` and `(storageType, { logLevel })` signatures.
    logLevelOrStorage: LogLevel | 'in-memory' = 'info',
    options?: { logLevel?: LogLevel; maxLogs?: number; storage?: LogStorage }
  ) {
    const resolvedLogLevel: LogLevel =
      logLevelOrStorage === 'in-memory'
        ? options?.logLevel ?? 'info'
        : (logLevelOrStorage as LogLevel);

    const resolvedMaxLogs = options?.maxLogs ?? 10000;

    this.logLevel = resolvedLogLevel;
    this.maxLogs = resolvedMaxLogs;
    this.storage = options?.storage ?? new InMemoryLogStorage(resolvedMaxLogs);
  }

  /**
   * Log an interaction or event
   */
  log(entry: Omit<LogEntry, 'id' | 'timestamp'>): void {
    // Extract level from metadata if not provided
    const level = entry.level || entry.metadata?.level || this.getLevelFromType(entry.type);
    
    const logEntry: LogEntry = {
      id: this.generateLogId(),
      timestamp: Date.now(),
      ...entry,
      level
    };

    // Check log level
    if (!this.shouldLog(entry.type)) {
      return;
    }

    // Add to in-memory log
    this.logs.push(logEntry);

    // Limit log size
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Persist to storage
    this.storage.saveLog(logEntry).catch(err => {
      console.error('Failed to persist log:', err);
    });

    // Emit event for real-time monitoring
    this.emitLogEvent(logEntry);
  }

  /**
   * Log a debug message
   */
  debug(message: string, metadata: Record<string, any> = {}, sessionId?: string): void {
    if (this.logLevel === 'debug') {
      this.log({
        type: 'debug',
        from: 'system',
        to: 'system',
        message,
        sessionId,
        metadata: { ...metadata, level: 'debug' }
      });
    }
  }

  /**
   * Log an info message
   */
  info(message: string, metadata: Record<string, any> = {}, sessionId?: string): void {
    if (['debug', 'info'].includes(this.logLevel)) {
      this.log({
        type: 'system',
        from: 'system',
        to: 'system',
        message,
        sessionId,
        level: 'info',
        metadata: { ...metadata, level: 'info' }
      });
    }
  }

  /**
   * Log a warning
   */
  warn(message: string, metadata: Record<string, any> = {}, sessionId?: string): void {
    if (['debug', 'info', 'warn'].includes(this.logLevel)) {
      this.log({
        type: 'system',
        from: 'system',
        to: 'system',
        message,
        sessionId,
        metadata: { ...metadata, level: 'warn' }
      });
    }
  }

  /**
   * Log an error
   */
  error(
    message: string,
    error?: Error | string,
    metadata: Record<string, any> = {},
    sessionId?: string
  ): void {
    this.log({
      type: 'error',
      from: 'system',
      to: 'system',
      message,
      sessionId,
      level: 'error',
      metadata: {
        ...metadata,
        level: 'error',
        error: error instanceof Error ? error.message : error,
        errorStack: error instanceof Error ? error.stack : undefined
      }
    });
  }

  /**
   * Query logs with filters
   */
  async queryLogs(filters: LogQueryFilters): Promise<LogEntry[]> {
    // Normalize friendly aliases used by tests
    const normalized: LogQueryFilters = {
      ...filters,
      logType: filters.type ?? filters.logType,
      logLevel: filters.level ?? filters.logLevel
    };

    const results = await this.storage.queryLogs(normalized);

    // Apply level/type filters on top of storage results so that tests using
    // `{ level: 'error' }` or `{ type: 'agent_to_agent' }` behave as expected.
    return results.filter(entry => {
      if (normalized.logType && entry.type !== normalized.logType) {
        return false;
      }
      if (normalized.logLevel) {
        const level = entry.metadata?.level || (entry.type === 'error' ? 'error' : 'info');
        if (level !== normalized.logLevel) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Get all logs (in-memory)
   */
  getAllLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * Clear logs
   */
  async clearLogs(olderThan?: number): Promise<number> {
    const count = await this.storage.clearLogs(olderThan);
    this.logs = [];
    return count;
  }

  /**
   * Subscribe to log events
   */
  onLog(callback: (entry: LogEntry) => void): () => void {
    if (!this.eventCallbacks.has('*')) {
      this.eventCallbacks.set('*', []);
    }
    this.eventCallbacks.get('*')!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.eventCallbacks.get('*');
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Subscribe to specific log type events
   */
  onLogType(type: LogEntry['type'], callback: (entry: LogEntry) => void): () => void {
    if (!this.eventCallbacks.has(type)) {
      this.eventCallbacks.set(type, []);
    }
    this.eventCallbacks.get(type)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.eventCallbacks.get(type);
      if (callbacks) {
        const index = callbacks.indexOf(callback);
        if (index > -1) {
          callbacks.splice(index, 1);
        }
      }
    };
  }

  /**
   * Set log level
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }

  /**
   * Get log level
   */
  getLogLevel(): LogLevel {
    return this.logLevel;
  }

  /**
   * Get log statistics
   */
  getStatistics(): {
    totalLogs: number;
    byType: Record<string, number>;
    byLevel: Record<string, number>;
    oldestLog: number | null;
    newestLog: number | null;
  } {
    const byType: Record<string, number> = {};
    const byLevel: Record<string, number> = {};

    let oldestLog: number | null = null;
    let newestLog: number | null = null;

    for (const log of this.logs) {
      // Count by type
      byType[log.type] = (byType[log.type] || 0) + 1;

      // Count by level
      const level = log.metadata?.level || 'info';
      byLevel[level] = (byLevel[level] || 0) + 1;

      // Track oldest and newest
      if (oldestLog === null || log.timestamp < oldestLog) {
        oldestLog = log.timestamp;
      }
      if (newestLog === null || log.timestamp > newestLog) {
        newestLog = log.timestamp;
      }
    }

    return {
      totalLogs: this.logs.length,
      byType,
      byLevel,
      oldestLog,
      newestLog
    };
  }

  /**
   * Export logs to JSON
   */
  exportLogs(filters?: LogQueryFilters): Promise<LogEntry[]> {
    if (filters) {
      return this.queryLogs(filters);
    }
    return Promise.resolve(this.getAllLogs());
  }

  /**
   * Check if should log based on log level
   */
  private shouldLog(type: LogEntry['type']): boolean {
    // Always log errors
    if (type === 'error') {
      return true;
    }

    // Check log level
    switch (this.logLevel) {
      case 'debug':
        return true;
      case 'info':
        return type !== 'debug';
      case 'warn':
        return ['warn', 'error', 'system'].includes(type);
      case 'error':
        return ['error'].includes(type);
      default:
        return true;
    }
  }

  /**
   * Emit log event to subscribers
   */
  private emitLogEvent(entry: LogEntry): void {
    // Emit to specific type subscribers
    const typeCallbacks = this.eventCallbacks.get(entry.type);
    if (typeCallbacks) {
      typeCallbacks.forEach(cb => cb(entry));
    }

    // Emit to wildcard subscribers
    const wildcardCallbacks = this.eventCallbacks.get('*');
    if (wildcardCallbacks) {
      wildcardCallbacks.forEach(cb => cb(entry));
    }
  }

  /**
   * Generate unique log ID
   */
  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Get log level from entry type
   */
  private getLevelFromType(type: LogEntry['type']): LogLevel {
    switch (type) {
      case 'error':
        return 'error';
      case 'debug':
        return 'debug';
      default:
        return 'info';
    }
  }

  /**
   * Log agent-to-agent message
   */
  async logAgentMessage(message: any, direction: 'sent' | 'received'): Promise<void> {
    const logEntry: Omit<LogEntry, 'id' | 'timestamp'> = {
      type: 'agent_to_agent',
      from: message.from || 'unknown',
      to: message.to || 'unknown',
      message: typeof message.content === 'string' 
        ? message.content 
        : JSON.stringify(message.content),
      sessionId: message.context?.sessionId,
      level: 'info',
      metadata: {
        messageId: message.id,
        threadId: message.context?.threadId,
        direction,
        messageType: message.type
      }
    };
    
    this.log(logEntry);
  }
}

// Export singleton instance
export const logger = new CentralLogger();


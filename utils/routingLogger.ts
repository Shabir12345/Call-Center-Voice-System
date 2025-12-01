/**
 * Routing Logger
 * 
 * Structured logging for routing decisions to support analytics and optimization.
 * Logs intent, candidates, chosen connection, scores, reasons, and outcomes.
 */

import { RoutingDecision, ConnectionScore, ConversationState, CallerIntent } from '../types';

export interface RoutingLogEntry {
  id: string;
  timestamp: number;
  sessionId?: string;
  currentNodeId: string;
  callerUtterance: string;
  intent?: CallerIntent;
  candidates: ConnectionScore[];
  decision: RoutingDecision;
  outcome?: 'success' | 'failure' | 'pending' | 'cancelled';
  outcomeDetails?: string;
  duration?: number; // Time taken to make decision (ms)
  metadata?: Record<string, any>;
}

export interface RoutingAnalytics {
  totalDecisions: number;
  averageScore: number;
  averageConfidence: number;
  fallbackUsage: number;
  clarificationCount: number;
  highRiskActions: number;
  confirmationsRequired: number;
  confirmationsGiven: number;
  byConnection: Record<string, {
    count: number;
    averageScore: number;
    successRate: number;
  }>;
  byIntent: Record<string, {
    count: number;
    averageScore: number;
    preferredConnections: string[];
  }>;
}

/**
 * Routing Logger class
 */
export class RoutingLogger {
  private logs: RoutingLogEntry[] = [];
  private maxLogSize: number;
  private storageKey: string = 'agentflow-routing-logs-v1';

  constructor(maxLogSize: number = 1000) {
    this.maxLogSize = maxLogSize;
    this.loadLogs();
  }

  /**
   * Log a routing decision
   */
  logDecision(
    currentNodeId: string,
    callerUtterance: string,
    conversationState: ConversationState,
    candidates: ConnectionScore[],
    decision: RoutingDecision,
    sessionId?: string,
    metadata?: Record<string, any>
  ): string {
    const logEntry: RoutingLogEntry = {
      id: `routing_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      sessionId,
      currentNodeId,
      callerUtterance,
      intent: conversationState.currentIntent,
      candidates,
      decision,
      outcome: 'pending',
      metadata: {
        ...metadata,
        clarificationCount: conversationState.clarificationCount,
        knownEntities: Object.keys(conversationState.knownEntities),
        flags: Object.keys(conversationState.flags),
      },
    };

    this.logs.push(logEntry);
    
    // Limit log size
    if (this.logs.length > this.maxLogSize) {
      this.logs = this.logs.slice(-this.maxLogSize);
    }

    // Persist to storage
    this.saveLogs();

    return logEntry.id;
  }

  /**
   * Update log entry outcome
   */
  updateOutcome(
    logId: string,
    outcome: 'success' | 'failure' | 'pending' | 'cancelled',
    details?: string
  ): void {
    const entry = this.logs.find(log => log.id === logId);
    if (entry) {
      entry.outcome = outcome;
      entry.outcomeDetails = details;
      entry.duration = Date.now() - entry.timestamp;
      this.saveLogs();
    }
  }

  /**
   * Get logs with filters
   */
  getLogs(filters?: {
    sessionId?: string;
    connectionId?: string;
    intentLabel?: string;
    outcome?: string;
    startTime?: number;
    endTime?: number;
  }): RoutingLogEntry[] {
    let filtered = [...this.logs];

    if (filters?.sessionId) {
      filtered = filtered.filter(log => log.sessionId === filters.sessionId);
    }

    if (filters?.connectionId) {
      filtered = filtered.filter(log => log.decision.chosenConnectionId === filters.connectionId);
    }

    if (filters?.intentLabel) {
      filtered = filtered.filter(log => log.intent?.intentLabel === filters.intentLabel);
    }

    if (filters?.outcome) {
      filtered = filtered.filter(log => log.outcome === filters.outcome);
    }

    if (filters?.startTime) {
      filtered = filtered.filter(log => log.timestamp >= filters.startTime!);
    }

    if (filters?.endTime) {
      filtered = filtered.filter(log => log.timestamp <= filters.endTime!);
    }

    return filtered.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get analytics from logs
   */
  getAnalytics(timeRange?: { start: number; end: number }): RoutingAnalytics {
    const logs = timeRange
      ? this.logs.filter(log => log.timestamp >= timeRange.start && log.timestamp <= timeRange.end)
      : this.logs;

    const analytics: RoutingAnalytics = {
      totalDecisions: logs.length,
      averageScore: 0,
      averageConfidence: 0,
      fallbackUsage: 0,
      clarificationCount: 0,
      highRiskActions: 0,
      confirmationsRequired: 0,
      confirmationsGiven: 0,
      byConnection: {},
      byIntent: {},
    };

    if (logs.length === 0) {
      return analytics;
    }

    let totalScore = 0;
    let totalConfidence = 0;
    let confirmationsRequiredCount = 0;
    let confirmationsGivenCount = 0;

    for (const log of logs) {
      totalScore += log.decision.score;
      if (log.intent) {
        totalConfidence += log.intent.confidence;
      }
      if (log.decision.usedFallback) {
        analytics.fallbackUsage++;
      }
      if (log.decision.requiredConfirmation) {
        confirmationsRequiredCount++;
        if (log.outcome === 'success') {
          confirmationsGivenCount++;
        }
      }
      if (log.metadata?.riskLevel === 'high') {
        analytics.highRiskActions++;
      }

      // Track by connection
      const connId = log.decision.chosenConnectionId;
      if (!analytics.byConnection[connId]) {
        analytics.byConnection[connId] = {
          count: 0,
          averageScore: 0,
          successRate: 0,
        };
      }
      analytics.byConnection[connId].count++;
      analytics.byConnection[connId].averageScore += log.decision.score;
      if (log.outcome === 'success') {
        analytics.byConnection[connId].successRate += 1;
      }

      // Track by intent
      if (log.intent) {
        const intentLabel = log.intent.intentLabel;
        if (!analytics.byIntent[intentLabel]) {
          analytics.byIntent[intentLabel] = {
            count: 0,
            averageScore: 0,
            preferredConnections: [],
          };
        }
        analytics.byIntent[intentLabel].count++;
        analytics.byIntent[intentLabel].averageScore += log.decision.score;
        
        if (!analytics.byIntent[intentLabel].preferredConnections.includes(connId)) {
          analytics.byIntent[intentLabel].preferredConnections.push(connId);
        }
      }
    }

    // Calculate averages
    analytics.averageScore = totalScore / logs.length;
    analytics.averageConfidence = totalConfidence / logs.length;
    analytics.confirmationsRequired = confirmationsRequiredCount;
    analytics.confirmationsGiven = confirmationsGivenCount;

    // Calculate connection averages
    for (const connId in analytics.byConnection) {
      const conn = analytics.byConnection[connId];
      conn.averageScore /= conn.count;
      conn.successRate /= conn.count;
    }

    // Calculate intent averages
    for (const intentLabel in analytics.byIntent) {
      const intent = analytics.byIntent[intentLabel];
      intent.averageScore /= intent.count;
    }

    return analytics;
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
    this.saveLogs();
  }

  /**
   * Save logs to storage
   */
  private saveLogs(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        // Only save recent logs to avoid storage limits
        const recentLogs = this.logs.slice(-100);
        localStorage.setItem(this.storageKey, JSON.stringify(recentLogs));
      }
    } catch (error) {
      console.error('Failed to save routing logs:', error);
    }
  }

  /**
   * Load logs from storage
   */
  private loadLogs(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(this.storageKey);
        if (stored) {
          this.logs = JSON.parse(stored);
        }
      }
    } catch (error) {
      console.error('Failed to load routing logs:', error);
      this.logs = [];
    }
  }
}

// Singleton instance
let loggerInstance: RoutingLogger | null = null;

/**
 * Get the singleton routing logger instance
 */
export function getRoutingLogger(): RoutingLogger {
  if (!loggerInstance) {
    loggerInstance = new RoutingLogger();
  }
  return loggerInstance;
}


/**
 * Usage Analytics
 * 
 * Tracks usage patterns, user behavior, and system metrics
 * for analytics and insights.
 */

import { CentralLogger } from './logger';
import { PerformanceMonitor, PerformanceMetrics } from './performanceMonitor';

/**
 * Analytics event
 */
export interface AnalyticsEvent {
  eventType: string;
  timestamp: number;
  sessionId?: string;
  userId?: string;
  agentId?: string;
  properties?: Record<string, any>;
}

/**
 * Usage metrics
 */
export interface UsageMetrics {
  totalSessions: number;
  activeSessions: number;
  totalMessages: number;
  averageMessagesPerSession: number;
  averageSessionDuration: number;
  topIntents: Array<{ intent: string; count: number }>;
  topAgents: Array<{ agentId: string; requestCount: number }>;
  errorRate: number;
  successRate: number;
}

/**
 * Analytics Manager
 */
export class AnalyticsManager {
  private logger: CentralLogger;
  private performanceMonitor: PerformanceMonitor;
  private events: AnalyticsEvent[] = [];
  private maxEvents: number = 10000;
  private intentCounts: Map<string, number> = new Map();
  private agentCounts: Map<string, number> = new Map();
  private sessionDurations: Map<string, { start: number; end?: number }> = new Map();

  constructor(logger: CentralLogger, performanceMonitor: PerformanceMonitor) {
    this.logger = logger;
    this.performanceMonitor = performanceMonitor;
  }

  /**
   * Track an event
   */
  trackEvent(
    eventType: string,
    properties?: Record<string, any>,
    sessionId?: string,
    userId?: string,
    agentId?: string
  ): void {
    const event: AnalyticsEvent = {
      eventType,
      timestamp: Date.now(),
      sessionId,
      userId,
      agentId,
      properties
    };

    this.events.push(event);

    // Trim events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }

    // Track specific events
    if (eventType === 'intent_recognized' && properties?.intent) {
      const count = this.intentCounts.get(properties.intent) || 0;
      this.intentCounts.set(properties.intent, count + 1);
    }

    if (agentId) {
      const count = this.agentCounts.get(agentId) || 0;
      this.agentCounts.set(agentId, count + 1);
    }

    if (eventType === 'session_start' && sessionId) {
      this.sessionDurations.set(sessionId, { start: Date.now() });
    }

    if (eventType === 'session_end' && sessionId) {
      const duration = this.sessionDurations.get(sessionId);
      if (duration) {
        duration.end = Date.now();
      }
    }
  }

  /**
   * Get usage metrics
   */
  getUsageMetrics(): UsageMetrics {
    const performanceMetrics = this.performanceMonitor.getMetrics();
    
    const sessions = Array.from(this.sessionDurations.values());
    const completedSessions = sessions.filter(s => s.end);
    
    const totalDuration = completedSessions.reduce(
      (sum, s) => sum + ((s.end || 0) - s.start),
      0
    );

    const topIntents = Array.from(this.intentCounts.entries())
      .map(([intent, count]) => ({ intent, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topAgents = Array.from(this.agentCounts.entries())
      .map(([agentId, requestCount]) => ({ agentId, requestCount }))
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, 10);

    const totalMessages = this.events.filter(e => 
      e.eventType === 'message_sent' || e.eventType === 'message_received'
    ).length;

    return {
      totalSessions: this.sessionDurations.size,
      activeSessions: sessions.filter(s => !s.end).length,
      totalMessages,
      averageMessagesPerSession: this.sessionDurations.size > 0
        ? totalMessages / this.sessionDurations.size
        : 0,
      averageSessionDuration: completedSessions.length > 0
        ? totalDuration / completedSessions.length
        : 0,
      topIntents,
      topAgents,
      errorRate: performanceMetrics.errorRate.percentage,
      successRate: 100 - performanceMetrics.errorRate.percentage
    };
  }

  /**
   * Get events by type
   */
  getEventsByType(eventType: string, limit?: number): AnalyticsEvent[] {
    const filtered = this.events.filter(e => e.eventType === eventType);
    return limit ? filtered.slice(-limit) : filtered;
  }

  /**
   * Get events for session
   */
  getSessionEvents(sessionId: string): AnalyticsEvent[] {
    return this.events.filter(e => e.sessionId === sessionId);
  }

  /**
   * Get events for user
   */
  getUserEvents(userId: string): AnalyticsEvent[] {
    return this.events.filter(e => e.userId === userId);
  }

  /**
   * Clear analytics data
   */
  clear(): void {
    this.events = [];
    this.intentCounts.clear();
    this.agentCounts.clear();
    this.sessionDurations.clear();
  }
}


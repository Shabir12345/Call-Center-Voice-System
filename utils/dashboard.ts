/**
 * Dashboard Data Provider
 * 
 * Provides aggregated data for dashboards and monitoring UIs
 */

import { PerformanceMonitor, PerformanceMetrics } from './performanceMonitor';
import { HealthChecker, HealthReport } from './healthChecker';
import { AnalyticsManager, UsageMetrics } from './analytics';
import { CentralLogger } from './logger';
import { SessionManager } from './sessionManager';
import { CacheManagerFactory } from './cacheManager';
import { AlertManager } from './alerting';
import { ReliabilityMetricsTracker, ReliabilityMetrics } from './reliabilityMetrics';
import { AnomalyDetector, Anomaly } from './anomalyDetection';

/**
 * Dashboard data
 */
export interface DashboardData {
  timestamp: number;
  performance: PerformanceMetrics;
  health: HealthReport;
  usage: UsageMetrics;
  sessions: {
    total: number;
    active: number;
    averageDuration: number;
    averageMessages: number;
  };
  cache: Record<string, any>;
  alerts: {
    active: number;
    critical: number;
    warning: number;
  };
  topAgents: Array<{
    agentId: string;
    requestCount: number;
    averageResponseTime: number;
    errorRate: number;
  }>;
  topIntents: Array<{
    intent: string;
    count: number;
  }>;
  reliability?: ReliabilityMetrics;
  anomalies?: Anomaly[];
}

/**
 * Dashboard update event types
 */
export type DashboardEventType = 'dataUpdate' | 'performanceChange' | 'healthChange' | 'alert' | 'anomaly' | '*';

/**
 * Dashboard update event
 */
export interface DashboardUpdateEvent {
  type: DashboardEventType;
  data?: DashboardData;
  timestamp: number;
  metadata?: Record<string, any>;
}

/**
 * Dashboard Provider
 */
export class DashboardProvider {
  private performanceMonitor: PerformanceMonitor;
  private healthChecker: HealthChecker;
  private analyticsManager: AnalyticsManager;
  private sessionManager: SessionManager;
  private alertManager: AlertManager;
  private logger: CentralLogger;
  private reliabilityTracker?: ReliabilityMetricsTracker;
  private anomalyDetector?: AnomalyDetector;
  
  // Event system
  private eventCallbacks: Map<DashboardEventType, Set<(event: DashboardUpdateEvent) => void>> = new Map();
  private updateInterval: NodeJS.Timeout | null = null;
  private lastData: DashboardData | null = null;
  private updateIntervalMs: number = 2000; // Default 2 seconds

  constructor(
    performanceMonitor: PerformanceMonitor,
    healthChecker: HealthChecker,
    analyticsManager: AnalyticsManager,
    sessionManager: SessionManager,
    alertManager: AlertManager,
    logger: CentralLogger,
    reliabilityTracker?: ReliabilityMetricsTracker,
    anomalyDetector?: AnomalyDetector,
    updateIntervalMs?: number
  ) {
    this.performanceMonitor = performanceMonitor;
    this.healthChecker = healthChecker;
    this.analyticsManager = analyticsManager;
    this.sessionManager = sessionManager;
    this.alertManager = alertManager;
    this.logger = logger;
    this.reliabilityTracker = reliabilityTracker;
    this.anomalyDetector = anomalyDetector;
    this.updateIntervalMs = updateIntervalMs || 2000;
    
    // Start automatic updates
    this.startAutoUpdates();
  }

  /**
   * Subscribe to dashboard updates
   * @param eventType - Event type to subscribe to ('*' for all events)
   * @param callback - Callback function
   * @returns Unsubscribe function
   */
  on(eventType: DashboardEventType, callback: (event: DashboardUpdateEvent) => void): () => void {
    if (!this.eventCallbacks.has(eventType)) {
      this.eventCallbacks.set(eventType, new Set());
    }
    
    this.eventCallbacks.get(eventType)!.add(callback);
    
    // Return unsubscribe function
    return () => {
      const callbacks = this.eventCallbacks.get(eventType);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.eventCallbacks.delete(eventType);
        }
      }
    };
  }

  /**
   * Emit dashboard update event
   */
  private emit(event: DashboardUpdateEvent): void {
    // Emit to specific event type subscribers
    const specificCallbacks = this.eventCallbacks.get(event.type);
    if (specificCallbacks) {
      specificCallbacks.forEach(cb => {
        try {
          cb(event);
        } catch (error) {
          this.logger.error('Error in dashboard event callback', { error, eventType: event.type });
        }
      });
    }

    // Emit to wildcard subscribers
    const wildcardCallbacks = this.eventCallbacks.get('*');
    if (wildcardCallbacks) {
      wildcardCallbacks.forEach(cb => {
        try {
          cb(event);
        } catch (error) {
          this.logger.error('Error in dashboard wildcard event callback', { error });
        }
      });
    }
  }

  /**
   * Start automatic updates with event emission
   */
  private startAutoUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }

    this.updateInterval = setInterval(async () => {
      try {
        const currentData = await this.getDashboardData();
        
        // Emit data update event
        this.emit({
          type: 'dataUpdate',
          data: currentData,
          timestamp: Date.now()
        });

        // Check for performance changes
        if (this.lastData) {
          const perfChanged = 
            Math.abs(currentData.performance.responseTime.average - this.lastData.performance.responseTime.average) > 100 ||
            Math.abs(currentData.performance.errorRate.percentage - this.lastData.performance.errorRate.percentage) > 1;
          
          if (perfChanged) {
            this.emit({
              type: 'performanceChange',
              data: currentData,
              timestamp: Date.now(),
              metadata: {
                previousAvgResponseTime: this.lastData.performance.responseTime.average,
                currentAvgResponseTime: currentData.performance.responseTime.average,
                previousErrorRate: this.lastData.performance.errorRate.percentage,
                currentErrorRate: currentData.performance.errorRate.percentage
              }
            });
          }

          // Check for health changes
          if (currentData.health.overall !== this.lastData.health.overall) {
            this.emit({
              type: 'healthChange',
              data: currentData,
              timestamp: Date.now(),
              metadata: {
                previousHealth: this.lastData.health.overall,
                currentHealth: currentData.health.overall
              }
            });
          }
        }

        // Check for new alerts
        if (currentData.alerts.active > (this.lastData?.alerts.active || 0)) {
          this.emit({
            type: 'alert',
            data: currentData,
            timestamp: Date.now(),
            metadata: {
              alertCount: currentData.alerts.active,
              criticalAlerts: currentData.alerts.critical
            }
          });
        }

        // Check for new anomalies
        if (currentData.anomalies && currentData.anomalies.length > (this.lastData?.anomalies?.length || 0)) {
          this.emit({
            type: 'anomaly',
            data: currentData,
            timestamp: Date.now(),
            metadata: {
              anomalyCount: currentData.anomalies.length
            }
          });
        }

        this.lastData = currentData;
      } catch (error) {
        this.logger.error('Error in dashboard auto-update', { error });
      }
    }, this.updateIntervalMs);
  }

  /**
   * Stop automatic updates
   */
  stopAutoUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Set update interval
   */
  setUpdateInterval(intervalMs: number): void {
    this.updateIntervalMs = intervalMs;
    this.startAutoUpdates();
  }

  /**
   * Get complete dashboard data
   */
  async getDashboardData(): Promise<DashboardData> {
    const performance = this.performanceMonitor.getMetrics();
    const health = await this.healthChecker.checkHealth();
    const usage = this.analyticsManager.getUsageMetrics();
    const sessionStats = this.sessionManager.getStatistics();
    const cacheStats = CacheManagerFactory.getAllStats();
    const activeAlerts = this.alertManager.getActiveAlerts();

    // Get top agents from performance metrics
    const topAgents = Object.entries(performance.agentMetrics)
      .map(([agentId, metrics]) => ({
        agentId,
        requestCount: metrics.requestCount,
        averageResponseTime: metrics.averageResponseTime,
        errorRate: metrics.errorCount > 0
          ? (metrics.errorCount / metrics.requestCount) * 100
          : 0
      }))
      .sort((a, b) => b.requestCount - a.requestCount)
      .slice(0, 10);

    const reliability = this.reliabilityTracker 
      ? this.reliabilityTracker.calculateMetrics()
      : undefined;

    const anomalies = this.anomalyDetector
      ? this.anomalyDetector.getRecentAnomalies(20)
      : undefined;

    return {
      timestamp: Date.now(),
      performance,
      health,
      usage,
      sessions: {
        total: sessionStats.totalSessions,
        active: sessionStats.activeSessions,
        averageDuration: sessionStats.averageDuration,
        averageMessages: sessionStats.averageMessageCount
      },
      cache: cacheStats,
      alerts: {
        active: activeAlerts.length,
        critical: activeAlerts.filter(a => a.severity === 'critical').length,
        warning: activeAlerts.filter(a => a.severity === 'warning').length
      },
      topAgents,
      topIntents: usage.topIntents,
      reliability,
      anomalies
    };
  }

  /**
   * Get performance summary
   */
  getPerformanceSummary(): {
    averageResponseTime: number;
    throughput: number;
    errorRate: number;
    status: 'good' | 'degraded' | 'poor';
  } {
    const metrics = this.performanceMonitor.getMetrics();
    
    let status: 'good' | 'degraded' | 'poor' = 'good';
    if (metrics.errorRate.percentage > 10 || metrics.responseTime.average > 5000) {
      status = 'poor';
    } else if (metrics.errorRate.percentage > 5 || metrics.responseTime.average > 3000) {
      status = 'degraded';
    }

    return {
      averageResponseTime: metrics.responseTime.average,
      throughput: metrics.throughput.requestsPerSecond,
      errorRate: metrics.errorRate.percentage,
      status
    };
  }

  /**
   * Get health summary
   */
  async getHealthSummary(): Promise<{
    overall: string;
    healthy: number;
    degraded: number;
    unhealthy: number;
  }> {
    const health = await this.healthChecker.checkHealth();
    return {
      overall: health.overall,
      healthy: health.summary.healthy,
      degraded: health.summary.degraded,
      unhealthy: health.summary.unhealthy
    };
  }

  /**
   * Get real-time metrics (last N minutes)
   */
  getRealTimeMetrics(minutes: number = 5): {
    requests: number;
    errors: number;
    averageResponseTime: number;
  } {
    const metrics = this.performanceMonitor.getMetrics();
    // In production, this would filter by time window
    return {
      requests: metrics.throughput.totalRequests,
      errors: metrics.errorRate.total,
      averageResponseTime: metrics.responseTime.average
    };
  }
}


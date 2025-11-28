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

  constructor(
    performanceMonitor: PerformanceMonitor,
    healthChecker: HealthChecker,
    analyticsManager: AnalyticsManager,
    sessionManager: SessionManager,
    alertManager: AlertManager,
    logger: CentralLogger,
    reliabilityTracker?: ReliabilityMetricsTracker,
    anomalyDetector?: AnomalyDetector
  ) {
    this.performanceMonitor = performanceMonitor;
    this.healthChecker = healthChecker;
    this.analyticsManager = analyticsManager;
    this.sessionManager = sessionManager;
    this.alertManager = alertManager;
    this.logger = logger;
    this.reliabilityTracker = reliabilityTracker;
    this.anomalyDetector = anomalyDetector;
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


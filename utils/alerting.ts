/**
 * Alerting System
 * 
 * Monitors system metrics and triggers alerts based on thresholds.
 * Supports multiple alert channels and alert aggregation.
 */

import { CentralLogger } from './logger';
import { PerformanceMonitor, PerformanceMetrics } from './performanceMonitor';
import { HealthChecker, HealthReport } from './healthChecker';

/**
 * Alert severity levels
 */
export type AlertSeverity = 'info' | 'warning' | 'critical';

/**
 * Alert channel types
 */
export type AlertChannel = 'log' | 'email' | 'webhook' | 'slack' | 'console';

/**
 * Alert configuration
 */
export interface AlertConfig {
  name: string;
  condition: (metrics: PerformanceMetrics | HealthReport) => boolean;
  severity: AlertSeverity;
  message: string | ((metrics: PerformanceMetrics | HealthReport) => string);
  channels: AlertChannel[];
  cooldownMs?: number; // Prevent alert spam
  enabled?: boolean;
}

/**
 * Alert
 */
export interface Alert {
  id: string;
  name: string;
  severity: AlertSeverity;
  message: string;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
  metadata?: Record<string, any>;
}

/**
 * Alert handler interface
 */
export interface AlertHandler {
  send(alert: Alert): Promise<void>;
}

/**
 * Alert Manager
 */
export class AlertManager {
  private logger: CentralLogger;
  private performanceMonitor: PerformanceMonitor;
  private healthChecker: HealthChecker;
  private alerts: Alert[] = [];
  private alertConfigs: AlertConfig[] = [];
  private alertHandlers: Map<AlertChannel, AlertHandler> = new Map();
  private lastAlertTimes: Map<string, number> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(
    logger: CentralLogger,
    performanceMonitor: PerformanceMonitor,
    healthChecker: HealthChecker
  ) {
    this.logger = logger;
    this.performanceMonitor = performanceMonitor;
    this.healthChecker = healthChecker;
    this.registerDefaultHandlers();
    this.setupDefaultAlerts();
  }

  /**
   * Register alert handler
   */
  registerHandler(channel: AlertChannel, handler: AlertHandler): void {
    this.alertHandlers.set(channel, handler);
  }

  /**
   * Add alert configuration
   */
  addAlertConfig(config: AlertConfig): void {
    this.alertConfigs.push(config);
  }

  /**
   * Check alerts
   */
  async checkAlerts(): Promise<void> {
    // Check performance-based alerts
    const performanceMetrics = this.performanceMonitor.getMetrics();
    for (const config of this.alertConfigs) {
      if (config.enabled === false) continue;

      try {
        if (config.condition(performanceMetrics)) {
          await this.triggerAlert(config, performanceMetrics);
        }
      } catch (error) {
        this.logger.error(`Error checking alert ${config.name}`, error);
      }
    }

    // Check health-based alerts
    const healthReport = await this.healthChecker.checkHealth();
    if (healthReport.overall !== 'healthy') {
      await this.triggerHealthAlert(healthReport);
    }
  }

  /**
   * Trigger alert
   */
  private async triggerAlert(
    config: AlertConfig,
    metrics: PerformanceMetrics | HealthReport
  ): Promise<void> {
    const alertKey = config.name;
    const now = Date.now();
    const lastAlertTime = this.lastAlertTimes.get(alertKey) || 0;

    // Check cooldown
    if (config.cooldownMs && (now - lastAlertTime) < config.cooldownMs) {
      return; // Still in cooldown
    }

    const message = typeof config.message === 'function'
      ? config.message(metrics)
      : config.message;

    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      name: config.name,
      severity: config.severity,
      message,
      timestamp: now,
      resolved: false,
      metadata: { metrics }
    };

    // Store alert
    this.alerts.push(alert);
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }

    // Update last alert time
    this.lastAlertTimes.set(alertKey, now);

    // Send to channels
    for (const channel of config.channels) {
      const handler = this.alertHandlers.get(channel);
      if (handler) {
        try {
          await handler.send(alert);
        } catch (error) {
          this.logger.error(`Failed to send alert via ${channel}`, error);
        }
      }
    }

    this.logger.warn(`Alert triggered: ${config.name}`, {
      severity: config.severity,
      message
    });
  }

  /**
   * Trigger health alert
   */
  private async triggerHealthAlert(healthReport: HealthReport): Promise<void> {
    const severity: AlertSeverity = healthReport.overall === 'unhealthy' ? 'critical' : 'warning';
    const unhealthyComponents = healthReport.components.filter(c => c.status !== 'healthy');

    const alert: Alert = {
      id: `health_alert_${Date.now()}`,
      name: 'System Health Degraded',
      severity,
      message: `System health is ${healthReport.overall}. Unhealthy components: ${unhealthyComponents.map(c => c.name).join(', ')}`,
      timestamp: Date.now(),
      resolved: false,
      metadata: { healthReport }
    };

    this.alerts.push(alert);

    // Send to log channel
    const logHandler = this.alertHandlers.get('log');
    if (logHandler) {
      await logHandler.send(alert);
    }
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = Date.now();
      this.logger.info(`Alert resolved: ${alert.name}`, { alertId });
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter(a => !a.resolved);
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity: AlertSeverity): Alert[] {
    return this.alerts.filter(a => a.severity === severity && !a.resolved);
  }

  /**
   * Start periodic alert checking
   */
  startPeriodicChecks(intervalMs: number = 60000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.checkAlerts().catch(error => {
        this.logger.error('Error during alert check', error);
      });
    }, intervalMs);
  }

  /**
   * Stop periodic checks
   */
  stopPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Register default handlers
   */
  private registerDefaultHandlers(): void {
    // Log handler
    this.registerHandler('log', {
      send: async (alert) => {
        const level = alert.severity === 'critical' ? 'error' : 
                     alert.severity === 'warning' ? 'warn' : 'info';
        await this.logger.log({
          level,
          type: 'system',
          message: `[ALERT] ${alert.name}: ${alert.message}`,
          metadata: {
            alertId: alert.id,
            severity: alert.severity,
            ...alert.metadata
          }
        });
      }
    });

    // Console handler
    this.registerHandler('console', {
      send: async (alert) => {
        const prefix = alert.severity === 'critical' ? '🚨' :
                      alert.severity === 'warning' ? '⚠️' : 'ℹ️';
        console.log(`${prefix} [${alert.severity.toUpperCase()}] ${alert.name}: ${alert.message}`);
      }
    });
  }

  /**
   * Setup default alerts
   */
  private setupDefaultAlerts(): void {
    // High error rate alert
    this.addAlertConfig({
      name: 'High Error Rate',
      condition: (metrics) => {
        if ('errorRate' in metrics) {
          return metrics.errorRate.percentage > 10;
        }
        return false;
      },
      severity: 'warning',
      message: (metrics) => {
        const m = metrics as PerformanceMetrics;
        return `Error rate is ${m.errorRate.percentage.toFixed(2)}% (threshold: 10%)`;
      },
      channels: ['log', 'console'],
      cooldownMs: 5 * 60 * 1000, // 5 minutes
      enabled: true
    });

    // Critical error rate alert
    this.addAlertConfig({
      name: 'Critical Error Rate',
      condition: (metrics) => {
        if ('errorRate' in metrics) {
          return metrics.errorRate.percentage > 20;
        }
        return false;
      },
      severity: 'critical',
      message: (metrics) => {
        const m = metrics as PerformanceMetrics;
        return `Critical error rate: ${m.errorRate.percentage.toFixed(2)}% (threshold: 20%)`;
      },
      channels: ['log', 'console'],
      cooldownMs: 2 * 60 * 1000, // 2 minutes
      enabled: true
    });

    // Slow response time alert
    this.addAlertConfig({
      name: 'Slow Response Time',
      condition: (metrics) => {
        if ('responseTime' in metrics) {
          return metrics.responseTime.average > 5000; // 5 seconds
        }
        return false;
      },
      severity: 'warning',
      message: (metrics) => {
        const m = metrics as PerformanceMetrics;
        return `Average response time is ${(m.responseTime.average / 1000).toFixed(2)}s (threshold: 5s)`;
      },
      channels: ['log', 'console'],
      cooldownMs: 10 * 60 * 1000, // 10 minutes
      enabled: true
    });

    // Low throughput alert
    this.addAlertConfig({
      name: 'Low Throughput',
      condition: (metrics) => {
        if ('throughput' in metrics) {
          return metrics.throughput.requestsPerSecond < 0.1 && metrics.throughput.totalRequests > 100;
        }
        return false;
      },
      severity: 'info',
      message: (metrics) => {
        const m = metrics as PerformanceMetrics;
        return `Throughput is ${m.throughput.requestsPerSecond.toFixed(2)} req/s`;
      },
      channels: ['log'],
      cooldownMs: 15 * 60 * 1000, // 15 minutes
      enabled: true
    });
  }
}


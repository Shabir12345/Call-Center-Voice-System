/**
 * Health Checker
 * 
 * Monitors system health including component status,
 * connectivity, and resource availability.
 */

import { CommunicationManager } from './agentCommunication';
import { StateManager } from './stateManager';
import { CentralLogger } from './logger';
import { PerformanceMonitor } from './performanceMonitor';

/**
 * Health status
 */
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Component health
 */
export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  message?: string;
  lastCheck: number;
  metrics?: Record<string, any>;
}

/**
 * System health report
 */
export interface HealthReport {
  overall: HealthStatus;
  timestamp: number;
  components: ComponentHealth[];
  summary: {
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

/**
 * Health Checker
 */
export class HealthChecker {
  private communicationManager: CommunicationManager;
  private stateManager: StateManager;
  private logger: CentralLogger;
  private performanceMonitor: PerformanceMonitor;
  private checkInterval: NodeJS.Timeout | null = null;
  private healthHistory: HealthReport[] = [];
  private maxHistorySize: number = 100;

  constructor(
    communicationManager: CommunicationManager,
    stateManager: StateManager,
    logger: CentralLogger,
    performanceMonitor: PerformanceMonitor
  ) {
    this.communicationManager = communicationManager;
    this.stateManager = stateManager;
    this.logger = logger;
    this.performanceMonitor = performanceMonitor;
  }

  /**
   * Perform health check
   */
  async checkHealth(): Promise<HealthReport> {
    const components: ComponentHealth[] = [];

    // Check communication manager
    components.push(await this.checkCommunicationManager());

    // Check state manager
    components.push(await this.checkStateManager());

    // Check performance
    components.push(await this.checkPerformance());

    // Check logger
    components.push(await this.checkLogger());

    // Calculate overall status
    const unhealthy = components.filter(c => c.status === 'unhealthy').length;
    const degraded = components.filter(c => c.status === 'degraded').length;

    let overall: HealthStatus = 'healthy';
    if (unhealthy > 0) {
      overall = 'unhealthy';
    } else if (degraded > 0) {
      overall = 'degraded';
    }

    const report: HealthReport = {
      overall,
      timestamp: Date.now(),
      components,
      summary: {
        healthy: components.filter(c => c.status === 'healthy').length,
        degraded,
        unhealthy
      }
    };

    // Store in history
    this.healthHistory.push(report);
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory = this.healthHistory.slice(-this.maxHistorySize);
    }

    return report;
  }

  /**
   * Check communication manager health
   */
  private async checkCommunicationManager(): Promise<ComponentHealth> {
    try {
      const stats = this.communicationManager.getStatistics();
      const hasActiveAgents = stats.registeredAgents > 0;
      const hasPendingRequests = stats.pendingRequests > 0;

      let status: HealthStatus = 'healthy';
      let message: string | undefined;

      if (!hasActiveAgents) {
        status = 'degraded';
        message = 'No agents registered';
      } else if (stats.pendingRequests > 100) {
        status = 'degraded';
        message = `High number of pending requests: ${stats.pendingRequests}`;
      }

      return {
        name: 'CommunicationManager',
        status,
        message,
        lastCheck: Date.now(),
        metrics: stats
      };
    } catch (error: any) {
      return {
        name: 'CommunicationManager',
        status: 'unhealthy',
        message: error.message,
        lastCheck: Date.now()
      };
    }
  }

  /**
   * Check state manager health
   */
  private async checkStateManager(): Promise<ComponentHealth> {
    try {
      const sessions = await this.stateManager.getActiveSessions();
      const sessionCount = sessions.length;

      let status: HealthStatus = 'healthy';
      let message: string | undefined;

      if (sessionCount === 0) {
        status = 'degraded';
        message = 'No active sessions';
      } else if (sessionCount > 10000) {
        status = 'degraded';
        message = `High number of active sessions: ${sessionCount}`;
      }

      return {
        name: 'StateManager',
        status,
        message,
        lastCheck: Date.now(),
        metrics: {
          activeSessions: sessionCount
        }
      };
    } catch (error: any) {
      return {
        name: 'StateManager',
        status: 'unhealthy',
        message: error.message,
        lastCheck: Date.now()
      };
    }
  }

  /**
   * Check performance health
   */
  private async checkPerformance(): Promise<ComponentHealth> {
    try {
      const metrics = this.performanceMonitor.getMetrics();

      let status: HealthStatus = 'healthy';
      let message: string | undefined;

      // Check if performance is degraded
      const isDegraded = this.performanceMonitor.isPerformanceDegraded({
        maxAverageResponseTime: 5000, // 5 seconds
        maxErrorRate: 10, // 10%
        minThroughput: 0.1 // 0.1 requests per second
      });

      if (isDegraded) {
        status = 'degraded';
        message = 'Performance metrics indicate degradation';
      }

      if (metrics.errorRate.percentage > 20) {
        status = 'unhealthy';
        message = `High error rate: ${metrics.errorRate.percentage.toFixed(2)}%`;
      }

      return {
        name: 'Performance',
        status,
        message,
        lastCheck: Date.now(),
        metrics: {
          averageResponseTime: metrics.responseTime.average,
          errorRate: metrics.errorRate.percentage,
          throughput: metrics.throughput.requestsPerSecond
        }
      };
    } catch (error: any) {
      return {
        name: 'Performance',
        status: 'unhealthy',
        message: error.message,
        lastCheck: Date.now()
      };
    }
  }

  /**
   * Check logger health
   */
  private async checkLogger(): Promise<ComponentHealth> {
    try {
      // Simple check - try to log something
      await this.logger.info('Health check', { component: 'HealthChecker' });

      return {
        name: 'Logger',
        status: 'healthy',
        lastCheck: Date.now()
      };
    } catch (error: any) {
      return {
        name: 'Logger',
        status: 'unhealthy',
        message: error.message,
        lastCheck: Date.now()
      };
    }
  }

  /**
   * Start periodic health checks
   */
  startPeriodicChecks(intervalMs: number = 60000): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      const report = await this.checkHealth();
      if (report.overall !== 'healthy') {
        this.logger.warn('Health check indicates issues', {
          overall: report.overall,
          components: report.components.filter(c => c.status !== 'healthy')
        });
      }
    }, intervalMs);
  }

  /**
   * Stop periodic health checks
   */
  stopPeriodicChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Get health history
   */
  getHealthHistory(limit?: number): HealthReport[] {
    if (limit) {
      return this.healthHistory.slice(-limit);
    }
    return [...this.healthHistory];
  }

  /**
   * Get latest health report
   */
  getLatestHealth(): HealthReport | null {
    return this.healthHistory.length > 0
      ? this.healthHistory[this.healthHistory.length - 1]
      : null;
  }
}


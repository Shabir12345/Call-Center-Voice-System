/**
 * Anomaly Detection System
 * 
 * Detects anomalies in system behavior including:
 * - Performance anomalies (unusual response times)
 * - Error rate anomalies (spikes in errors)
 * - Usage pattern anomalies (unusual traffic patterns)
 * - Resource usage anomalies
 */

import { PerformanceMonitor, PerformanceMetrics } from './performanceMonitor';
import { AnalyticsManager, UsageMetrics } from './analytics';
import { CentralLogger } from './logger';

/**
 * Anomaly type
 */
export type AnomalyType = 
  | 'performance_degradation'
  | 'error_spike'
  | 'traffic_spike'
  | 'traffic_drop'
  | 'resource_exhaustion'
  | 'latency_spike'
  | 'throughput_drop';

/**
 * Anomaly severity
 */
export type AnomalySeverity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Anomaly detection result
 */
export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  detectedAt: number;
  description: string;
  metric: string;
  value: number;
  baseline: number;
  deviation: number; // Percentage deviation from baseline
  component?: string;
  recommendations?: string[];
}

/**
 * Anomaly detection configuration
 */
export interface AnomalyDetectionConfig {
  enabled: boolean;
  sensitivity: 'low' | 'medium' | 'high'; // How sensitive to deviations
  baselineWindow: number; // Time window in ms for baseline calculation
  minDeviation: number; // Minimum percentage deviation to trigger
  checkInterval: number; // How often to check for anomalies
}

/**
 * Default anomaly detection configuration
 */
export const DEFAULT_ANOMALY_CONFIG: AnomalyDetectionConfig = {
  enabled: true,
  sensitivity: 'medium',
  baselineWindow: 3600000, // 1 hour
  minDeviation: 20, // 20% deviation minimum
  checkInterval: 60000 // Check every minute
};

/**
 * Anomaly Detector
 */
export class AnomalyDetector {
  private performanceMonitor: PerformanceMonitor;
  private analyticsManager: AnalyticsManager;
  private logger: CentralLogger;
  private config: AnomalyDetectionConfig;
  private metricsHistory: Array<{
    timestamp: number;
    metrics: PerformanceMetrics;
    usage?: UsageMetrics;
  }> = [];
  private maxHistorySize: number = 100;
  private anomalies: Anomaly[] = [];
  private maxAnomalies: number = 1000;
  private checkInterval?: ReturnType<typeof setInterval>;

  constructor(
    performanceMonitor: PerformanceMonitor,
    analyticsManager: AnalyticsManager,
    logger: CentralLogger,
    config: Partial<AnomalyDetectionConfig> = {}
  ) {
    this.performanceMonitor = performanceMonitor;
    this.analyticsManager = analyticsManager;
    this.logger = logger;
    this.config = { ...DEFAULT_ANOMALY_CONFIG, ...config };

    if (this.config.enabled) {
      this.startMonitoring();
    }
  }

  /**
   * Start monitoring for anomalies
   */
  startMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(() => {
      this.detectAnomalies();
    }, this.config.checkInterval);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
  }

  /**
   * Detect anomalies in current metrics
   */
  detectAnomalies(): Anomaly[] {
    const currentMetrics = this.performanceMonitor.getMetrics();
    const currentUsage = this.analyticsManager.getUsageMetrics();
    const now = Date.now();

    // Store current metrics
    this.metricsHistory.push({
      timestamp: now,
      metrics: currentMetrics,
      usage: currentUsage
    });

    // Trim history
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory = this.metricsHistory.slice(-this.maxHistorySize);
    }

    // Calculate baseline from history
    const baselineWindow = this.metricsHistory.filter(
      entry => entry.timestamp >= now - this.config.baselineWindow
    );

    if (baselineWindow.length < 2) {
      // Not enough data yet
      return [];
    }

    const detected: Anomaly[] = [];

    // Check for performance anomalies
    detected.push(...this.detectPerformanceAnomalies(currentMetrics, baselineWindow));
    
    // Check for error rate anomalies
    detected.push(...this.detectErrorAnomalies(currentMetrics, baselineWindow));
    
    // Check for usage anomalies
    if (currentUsage) {
      detected.push(...this.detectUsageAnomalies(currentUsage, baselineWindow));
    }

    // Store detected anomalies
    detected.forEach(anomaly => {
      this.anomalies.push(anomaly);
      this.logger.warn(`Anomaly detected: ${anomaly.type}`, {
        severity: anomaly.severity,
        deviation: anomaly.deviation,
        metric: anomaly.metric
      });
    });

    // Trim anomalies
    if (this.anomalies.length > this.maxAnomalies) {
      this.anomalies = this.anomalies.slice(-this.maxAnomalies);
    }

    return detected;
  }

  /**
   * Detect performance anomalies
   */
  private detectPerformanceAnomalies(
    current: PerformanceMetrics,
    baseline: Array<{ timestamp: number; metrics: PerformanceMetrics; usage?: UsageMetrics }>
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Calculate baseline response time
    const baselineResponseTimes = baseline.map(e => e.metrics.responseTime.average);
    const avgBaselineResponseTime = baselineResponseTimes.reduce((a, b) => a + b, 0) / baselineResponseTimes.length;

    // Check for latency spike
    const latencyDeviation = ((current.responseTime.average - avgBaselineResponseTime) / avgBaselineResponseTime) * 100;
    
    if (Math.abs(latencyDeviation) >= this.getThreshold('latency')) {
      anomalies.push({
        id: `anomaly_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        type: latencyDeviation > 0 ? 'latency_spike' : 'performance_degradation',
        severity: this.calculateSeverity(Math.abs(latencyDeviation)),
        detectedAt: Date.now(),
        description: `Response time ${latencyDeviation > 0 ? 'increased' : 'decreased'} by ${Math.abs(latencyDeviation).toFixed(1)}%`,
        metric: 'response_time_average',
        value: current.responseTime.average,
        baseline: avgBaselineResponseTime,
        deviation: latencyDeviation,
        recommendations: [
          'Check system load',
          'Review recent deployments',
          'Investigate external dependencies'
        ]
      });
    }

    // Check for throughput drop
    const baselineThroughput = baseline.map(e => e.metrics.throughput.requestsPerSecond);
    const avgBaselineThroughput = baselineThroughput.reduce((a, b) => a + b, 0) / baselineThroughput.length;
    const throughputDeviation = ((current.throughput.requestsPerSecond - avgBaselineThroughput) / avgBaselineThroughput) * 100;

    if (throughputDeviation <= -this.getThreshold('throughput')) {
      anomalies.push({
        id: `anomaly_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        type: 'throughput_drop',
        severity: this.calculateSeverity(Math.abs(throughputDeviation)),
        detectedAt: Date.now(),
        description: `Throughput dropped by ${Math.abs(throughputDeviation).toFixed(1)}%`,
        metric: 'throughput_requests_per_second',
        value: current.throughput.requestsPerSecond,
        baseline: avgBaselineThroughput,
        deviation: throughputDeviation,
        recommendations: [
          'Check for bottlenecks',
          'Review system capacity',
          'Investigate resource constraints'
        ]
      });
    }

    return anomalies;
  }

  /**
   * Detect error rate anomalies
   */
  private detectErrorAnomalies(
    current: PerformanceMetrics,
    baseline: Array<{ timestamp: number; metrics: PerformanceMetrics; usage?: UsageMetrics }>
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // Calculate baseline error rate
    const baselineErrorRates = baseline.map(e => e.metrics.errorRate.percentage);
    const avgBaselineErrorRate = baselineErrorRates.reduce((a, b) => a + b, 0) / baselineErrorRates.length;

    if (avgBaselineErrorRate === 0) {
      // If baseline is 0, any error is an anomaly
      if (current.errorRate.percentage > 0) {
        anomalies.push({
          id: `anomaly_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          type: 'error_spike',
          severity: 'critical',
          detectedAt: Date.now(),
          description: `Error rate increased from ${avgBaselineErrorRate.toFixed(2)}% to ${current.errorRate.percentage.toFixed(2)}%`,
          metric: 'error_rate_percentage',
          value: current.errorRate.percentage,
          baseline: avgBaselineErrorRate,
          deviation: 100,
          recommendations: [
            'Check error logs immediately',
            'Review recent changes',
            'Check external dependencies'
          ]
        });
      }
      return anomalies;
    }

    const errorDeviation = ((current.errorRate.percentage - avgBaselineErrorRate) / avgBaselineErrorRate) * 100;

    if (errorDeviation >= this.getThreshold('error_rate')) {
      anomalies.push({
        id: `anomaly_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        type: 'error_spike',
        severity: this.calculateSeverity(errorDeviation),
        detectedAt: Date.now(),
        description: `Error rate increased by ${errorDeviation.toFixed(1)}%`,
        metric: 'error_rate_percentage',
        value: current.errorRate.percentage,
        baseline: avgBaselineErrorRate,
        deviation: errorDeviation,
        recommendations: [
          'Check error logs',
          'Review recent deployments',
          'Investigate root cause'
        ]
      });
    }

    return anomalies;
  }

  /**
   * Detect usage anomalies
   */
  private detectUsageAnomalies(
    current: UsageMetrics,
    baseline: Array<{ timestamp: number; metrics: PerformanceMetrics; usage?: UsageMetrics }>
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const baselineWithUsage = baseline.filter(e => e.usage);

    if (baselineWithUsage.length < 2) {
      return anomalies;
    }

    // Check for traffic spike
    const baselineMessages = baselineWithUsage.map(e => e.usage!.totalMessages);
    const avgBaselineMessages = baselineMessages.reduce((a, b) => a + b, 0) / baselineMessages.length;

    if (avgBaselineMessages > 0) {
      const trafficDeviation = ((current.totalMessages - avgBaselineMessages) / avgBaselineMessages) * 100;

      if (trafficDeviation >= this.getThreshold('traffic')) {
        anomalies.push({
          id: `anomaly_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          type: 'traffic_spike',
          severity: this.calculateSeverity(trafficDeviation),
          detectedAt: Date.now(),
          description: `Traffic increased by ${trafficDeviation.toFixed(1)}%`,
          metric: 'total_messages',
          value: current.totalMessages,
          baseline: avgBaselineMessages,
          deviation: trafficDeviation,
          recommendations: [
            'Verify if expected',
            'Check for DDoS',
            'Scale resources if needed'
          ]
        });
      } else if (trafficDeviation <= -this.getThreshold('traffic')) {
        anomalies.push({
          id: `anomaly_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          type: 'traffic_drop',
          severity: this.calculateSeverity(Math.abs(trafficDeviation)),
          detectedAt: Date.now(),
          description: `Traffic dropped by ${Math.abs(trafficDeviation).toFixed(1)}%`,
          metric: 'total_messages',
          value: current.totalMessages,
          baseline: avgBaselineMessages,
          deviation: trafficDeviation,
          recommendations: [
            'Check system connectivity',
            'Verify external services',
            'Check for outages'
          ]
        });
      }
    }

    return anomalies;
  }

  /**
   * Get threshold for anomaly type based on sensitivity
   */
  private getThreshold(type: string): number {
    const thresholds: Record<string, Record<string, number>> = {
      latency: { low: 50, medium: 30, high: 20 },
      throughput: { low: 40, medium: 25, high: 15 },
      error_rate: { low: 100, medium: 50, high: 25 },
      traffic: { low: 80, medium: 50, high: 30 }
    };

    return thresholds[type]?.[this.config.sensitivity] || this.config.minDeviation;
  }

  /**
   * Calculate severity based on deviation
   */
  private calculateSeverity(deviation: number): AnomalySeverity {
    if (deviation >= 200) return 'critical';
    if (deviation >= 100) return 'high';
    if (deviation >= 50) return 'medium';
    return 'low';
  }

  /**
   * Get recent anomalies
   */
  getRecentAnomalies(limit: number = 50): Anomaly[] {
    return this.anomalies.slice(-limit).reverse();
  }

  /**
   * Get anomalies by type
   */
  getAnomaliesByType(type: AnomalyType): Anomaly[] {
    return this.anomalies.filter(a => a.type === type);
  }

  /**
   * Get anomalies by severity
   */
  getAnomaliesBySeverity(severity: AnomalySeverity): Anomaly[] {
    return this.anomalies.filter(a => a.severity === severity);
  }

  /**
   * Clear anomaly history
   */
  clearHistory(): void {
    this.anomalies = [];
    this.metricsHistory = [];
  }
}


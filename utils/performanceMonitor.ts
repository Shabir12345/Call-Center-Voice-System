/**
 * Performance Monitor
 * 
 * Tracks system performance metrics including response times,
 * throughput, error rates, and resource usage.
 */

import { CentralLogger } from './logger';

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  timestamp: number;
  responseTime: {
    average: number;
    p50: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
  };
  throughput: {
    requestsPerSecond: number;
    requestsPerMinute: number;
    totalRequests: number;
  };
  errorRate: {
    total: number;
    percentage: number;
    byType: Record<string, number>;
  };
  agentMetrics: {
    [agentId: string]: {
      requestCount: number;
      averageResponseTime: number;
      errorCount: number;
    };
  };
}

/**
 * Request timing data
 */
interface RequestTiming {
  startTime: number;
  endTime?: number;
  agentId?: string;
  success: boolean;
  errorType?: string;
}

/**
 * Performance Monitor
 */
export class PerformanceMonitor {
  private logger: CentralLogger;
  private requestTimings: RequestTiming[] = [];
  private maxTimings: number = 10000; // Keep last 10k requests
  private startTime: number = Date.now();
  private requestCount: number = 0;
  private errorCount: number = 0;
  private errorTypes: Map<string, number> = new Map();
  private agentMetrics: Map<string, {
    requestCount: number;
    totalResponseTime: number;
    errorCount: number;
  }> = new Map();

  constructor(logger: CentralLogger) {
    this.logger = logger;
  }

  /**
   * Start tracking a request
   */
  startRequest(agentId?: string): string {
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    this.requestTimings.push({
      startTime: Date.now(),
      agentId,
      success: false
    });
    this.requestCount++;
    return requestId;
  }

  /**
   * End tracking a request
   */
  endRequest(requestId: string, success: boolean, errorType?: string): void {
    const timing = this.requestTimings[this.requestTimings.length - 1];
    if (!timing) return;

    timing.endTime = Date.now();
    timing.success = success;
    if (errorType) {
      timing.errorType = errorType;
      this.errorCount++;
      this.errorTypes.set(errorType, (this.errorTypes.get(errorType) || 0) + 1);
    }

    // Update agent metrics
    if (timing.agentId) {
      const agentMetric = this.agentMetrics.get(timing.agentId) || {
        requestCount: 0,
        totalResponseTime: 0,
        errorCount: 0
      };
      agentMetric.requestCount++;
      agentMetric.totalResponseTime += (timing.endTime - timing.startTime);
      if (!success) {
        agentMetric.errorCount++;
      }
      this.agentMetrics.set(timing.agentId, agentMetric);
    }

    // Trim old timings
    if (this.requestTimings.length > this.maxTimings) {
      this.requestTimings = this.requestTimings.slice(-this.maxTimings);
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): PerformanceMetrics {
    const now = Date.now();
    const elapsedSeconds = (now - this.startTime) / 1000;
    const elapsedMinutes = elapsedSeconds / 60;

    // Calculate response times
    const completedTimings = this.requestTimings.filter(t => t.endTime);
    const responseTimes = completedTimings.map(t => t.endTime! - t.startTime).sort((a, b) => a - b);

    const responseTime = {
      average: responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0,
      p50: this.percentile(responseTimes, 50),
      p95: this.percentile(responseTimes, 95),
      p99: this.percentile(responseTimes, 99),
      min: responseTimes.length > 0 ? responseTimes[0] : 0,
      max: responseTimes.length > 0 ? responseTimes[responseTimes.length - 1] : 0
    };

    // Calculate throughput
    const throughput = {
      requestsPerSecond: elapsedSeconds > 0 ? this.requestCount / elapsedSeconds : 0,
      requestsPerMinute: elapsedMinutes > 0 ? this.requestCount / elapsedMinutes : 0,
      totalRequests: this.requestCount
    };

    // Calculate error rate
    const errorByType: Record<string, number> = {};
    this.errorTypes.forEach((count, type) => {
      errorByType[type] = count;
    });

    const errorRate = {
      total: this.errorCount,
      percentage: this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0,
      byType: errorByType
    };

    // Agent metrics
    const agentMetrics: Record<string, any> = {};
    this.agentMetrics.forEach((metric, agentId) => {
      agentMetrics[agentId] = {
        requestCount: metric.requestCount,
        averageResponseTime: metric.requestCount > 0
          ? metric.totalResponseTime / metric.requestCount
          : 0,
        errorCount: metric.errorCount
      };
    });

    return {
      timestamp: now,
      responseTime,
      throughput,
      errorRate,
      agentMetrics
    };
  }

  /**
   * Calculate percentile
   */
  private percentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)] || 0;
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.requestTimings = [];
    this.startTime = Date.now();
    this.requestCount = 0;
    this.errorCount = 0;
    this.errorTypes.clear();
    this.agentMetrics.clear();
    this.logger.info('Performance metrics reset');
  }

  /**
   * Get agent performance
   */
  getAgentPerformance(agentId: string): {
    requestCount: number;
    averageResponseTime: number;
    errorCount: number;
    errorRate: number;
  } | null {
    const metric = this.agentMetrics.get(agentId);
    if (!metric) return null;

    return {
      requestCount: metric.requestCount,
      averageResponseTime: metric.requestCount > 0
        ? metric.totalResponseTime / metric.requestCount
        : 0,
      errorCount: metric.errorCount,
      errorRate: metric.requestCount > 0
        ? (metric.errorCount / metric.requestCount) * 100
        : 0
    };
  }

  /**
   * Check if performance is degraded
   */
  isPerformanceDegraded(thresholds: {
    maxAverageResponseTime?: number;
    maxErrorRate?: number;
    minThroughput?: number;
  }): boolean {
    const metrics = this.getMetrics();

    if (thresholds.maxAverageResponseTime && 
        metrics.responseTime.average > thresholds.maxAverageResponseTime) {
      return true;
    }

    if (thresholds.maxErrorRate && 
        metrics.errorRate.percentage > thresholds.maxErrorRate) {
      return true;
    }

    if (thresholds.minThroughput && 
        metrics.throughput.requestsPerSecond < thresholds.minThroughput) {
      return true;
    }

    return false;
  }
}


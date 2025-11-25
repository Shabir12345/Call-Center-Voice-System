/**
 * Communication Monitor
 * 
 * Provides comprehensive monitoring, logging, metrics collection, and anomaly detection
 * for agent-to-agent communications. Inspired by LumiMAS framework patterns.
 */

import { CommunicationEvent, AgentMessage, ConversationThread } from '../types';

/**
 * Communication metrics
 */
export interface CommunicationMetrics {
  totalMessages: number;
  successfulMessages: number;
  failedMessages: number;
  averageLatency: number;
  messagesByType: Record<string, number>;
  messagesByAgent: Record<string, { sent: number; received: number; errors: number }>;
  errorRate: number;
  successRate: number;
  timeWindow: { start: number; end: number };
}

/**
 * Anomaly detection result
 */
export interface AnomalyResult {
  type: 'latency_spike' | 'error_spike' | 'unusual_pattern' | 'timeout_increase';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  timestamp: number;
  metadata: Record<string, any>;
}

/**
 * Communication Logger
 * Logs all agent interactions with detailed metadata
 */
export class CommunicationLogger {
  private events: CommunicationEvent[] = [];
  private maxEvents: number = 10000; // Maximum events to keep in memory
  private enabled: boolean = true;

  /**
   * Logs a communication event
   * @param event - Event to log
   */
  log(event: CommunicationEvent): void {
    if (!this.enabled) return;

    this.events.push(event);

    // Trim old events if we exceed max
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents);
    }
  }

  /**
   * Gets all logged events
   * @param filters - Optional filters
   * @returns Array of events
   */
  getEvents(filters?: {
    from?: string;
    to?: string;
    type?: string;
    success?: boolean;
    startTime?: number;
    endTime?: number;
  }): CommunicationEvent[] {
    let filtered = [...this.events];

    if (filters) {
      if (filters.from) {
        filtered = filtered.filter(e => e.from === filters.from);
      }
      if (filters.to) {
        filtered = filtered.filter(e => e.to === filters.to);
      }
      if (filters.type) {
        filtered = filtered.filter(e => e.type === filters.type);
      }
      if (filters.success !== undefined) {
        filtered = filtered.filter(e => e.success === filters.success);
      }
      if (filters.startTime) {
        filtered = filtered.filter(e => e.timestamp >= filters.startTime!);
      }
      if (filters.endTime) {
        filtered = filtered.filter(e => e.timestamp <= filters.endTime!);
      }
    }

    return filtered.sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Clears all logged events
   */
  clear(): void {
    this.events = [];
  }

  /**
   * Exports events to JSON
   * @returns JSON string
   */
  export(): string {
    return JSON.stringify(this.events, null, 2);
  }

  /**
   * Sets the maximum number of events to keep
   * @param max - Maximum events
   */
  setMaxEvents(max: number): void {
    this.maxEvents = max;
  }

  /**
   * Enables or disables logging
   * @param enabled - Whether logging is enabled
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
}

/**
 * Metrics Collector
 * Tracks communication patterns, latency, and success rates
 */
export class MetricsCollector {
  private logger: CommunicationLogger;
  private windowSize: number = 60000; // 1 minute default window

  constructor(logger: CommunicationLogger) {
    this.logger = logger;
  }

  /**
   * Calculates metrics for a time window
   * @param startTime - Start timestamp
   * @param endTime - End timestamp (defaults to now)
   * @returns Communication metrics
   */
  calculateMetrics(startTime?: number, endTime?: number): CommunicationMetrics {
    const end = endTime || Date.now();
    const start = startTime || (end - this.windowSize);

    const events = this.logger.getEvents({ startTime: start, endTime: end });
    const successfulEvents = events.filter(e => e.success);
    const failedEvents = events.filter(e => !e.success);

    // Calculate latency (only for events with duration)
    const eventsWithDuration = events.filter(e => e.duration !== undefined) as Array<CommunicationEvent & { duration: number }>;
    const averageLatency = eventsWithDuration.length > 0
      ? eventsWithDuration.reduce((sum, e) => sum + e.duration, 0) / eventsWithDuration.length
      : 0;

    // Count messages by type
    const messagesByType: Record<string, number> = {};
    events.forEach(e => {
      messagesByType[e.type] = (messagesByType[e.type] || 0) + 1;
    });

    // Count messages by agent
    const messagesByAgent: Record<string, { sent: number; received: number; errors: number }> = {};
    events.forEach(e => {
      // Count sent messages
      if (!messagesByAgent[e.from]) {
        messagesByAgent[e.from] = { sent: 0, received: 0, errors: 0 };
      }
      messagesByAgent[e.from].sent++;
      if (!e.success) {
        messagesByAgent[e.from].errors++;
      }

      // Count received messages
      if (!messagesByAgent[e.to]) {
        messagesByAgent[e.to] = { sent: 0, received: 0, errors: 0 };
      }
      messagesByAgent[e.to].received++;
      if (!e.success) {
        messagesByAgent[e.to].errors++;
      }
    });

    const totalMessages = events.length;
    const successfulMessages = successfulEvents.length;
    const failedMessages = failedEvents.length;

    return {
      totalMessages,
      successfulMessages,
      failedMessages,
      averageLatency,
      messagesByType,
      messagesByAgent,
      errorRate: totalMessages > 0 ? failedMessages / totalMessages : 0,
      successRate: totalMessages > 0 ? successfulMessages / totalMessages : 0,
      timeWindow: { start, end }
    };
  }

  /**
   * Gets real-time metrics (last window)
   * @returns Current metrics
   */
  getRealTimeMetrics(): CommunicationMetrics {
    return this.calculateMetrics();
  }

  /**
   * Sets the time window size for metrics calculation
   * @param size - Window size in milliseconds
   */
  setWindowSize(size: number): void {
    this.windowSize = size;
  }
}

/**
 * Anomaly Detector
 * Detects unusual communication patterns in real-time
 */
export class AnomalyDetector {
  private logger: CommunicationLogger;
  private metricsCollector: MetricsCollector;
  private baselineMetrics: CommunicationMetrics | null = null;
  private thresholds: {
    latencySpike: number; // Percentage increase
    errorSpike: number; // Percentage increase
    timeoutThreshold: number; // Milliseconds
  } = {
    latencySpike: 200, // 200% increase
    errorSpike: 300, // 300% increase
    timeoutThreshold: 30000 // 30 seconds
  };

  constructor(logger: CommunicationLogger, metricsCollector: MetricsCollector) {
    this.logger = logger;
    this.metricsCollector = metricsCollector;
  }

  /**
   * Establishes baseline metrics for comparison
   * @param duration - Duration to collect baseline (milliseconds)
   * @returns Promise that resolves when baseline is established
   */
  async establishBaseline(duration: number = 60000): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(() => {
        this.baselineMetrics = this.metricsCollector.calculateMetrics();
        resolve();
      }, duration);
    });
  }

  /**
   * Detects anomalies in recent communication
   * @returns Array of detected anomalies
   */
  detectAnomalies(): AnomalyResult[] {
    const anomalies: AnomalyResult[] = [];
    const currentMetrics = this.metricsCollector.getRealTimeMetrics();

    if (!this.baselineMetrics) {
      return anomalies; // No baseline established yet
    }

    // Check for latency spike
    if (this.baselineMetrics.averageLatency > 0) {
      const latencyIncrease = ((currentMetrics.averageLatency - this.baselineMetrics.averageLatency) / this.baselineMetrics.averageLatency) * 100;
      if (latencyIncrease > this.thresholds.latencySpike) {
        anomalies.push({
          type: 'latency_spike',
          severity: latencyIncrease > 500 ? 'critical' : latencyIncrease > 300 ? 'high' : 'medium',
          description: `Latency increased by ${latencyIncrease.toFixed(1)}% (${this.baselineMetrics.averageLatency.toFixed(0)}ms → ${currentMetrics.averageLatency.toFixed(0)}ms)`,
          timestamp: Date.now(),
          metadata: {
            baselineLatency: this.baselineMetrics.averageLatency,
            currentLatency: currentMetrics.averageLatency,
            increase: latencyIncrease
          }
        });
      }
    }

    // Check for error spike
    if (this.baselineMetrics.errorRate > 0) {
      const errorRateIncrease = ((currentMetrics.errorRate - this.baselineMetrics.errorRate) / this.baselineMetrics.errorRate) * 100;
      if (errorRateIncrease > this.thresholds.errorSpike) {
        anomalies.push({
          type: 'error_spike',
          severity: errorRateIncrease > 500 ? 'critical' : errorRateIncrease > 300 ? 'high' : 'medium',
          description: `Error rate increased by ${errorRateIncrease.toFixed(1)}% (${(this.baselineMetrics.errorRate * 100).toFixed(1)}% → ${(currentMetrics.errorRate * 100).toFixed(1)}%)`,
          timestamp: Date.now(),
          metadata: {
            baselineErrorRate: this.baselineMetrics.errorRate,
            currentErrorRate: currentMetrics.errorRate,
            increase: errorRateIncrease
          }
        });
      }
    } else if (currentMetrics.errorRate > 0.1) {
      // If baseline had no errors but current has errors
      anomalies.push({
        type: 'error_spike',
        severity: currentMetrics.errorRate > 0.3 ? 'high' : 'medium',
        description: `Error rate is ${(currentMetrics.errorRate * 100).toFixed(1)}% (baseline had no errors)`,
        timestamp: Date.now(),
        metadata: {
          currentErrorRate: currentMetrics.errorRate
        }
      });
    }

    // Check for timeout increase
    const recentEvents = this.logger.getEvents({
      startTime: Date.now() - 60000,
      success: false
    });
    const timeoutEvents = recentEvents.filter(e => 
      e.error?.includes('timeout') || e.error?.includes('Timeout') || 
      (e.duration && e.duration > this.thresholds.timeoutThreshold)
    );
    
    if (timeoutEvents.length > 0) {
      anomalies.push({
        type: 'timeout_increase',
        severity: timeoutEvents.length > 5 ? 'high' : 'medium',
        description: `${timeoutEvents.length} timeout(s) detected in the last minute`,
        timestamp: Date.now(),
        metadata: {
          timeoutCount: timeoutEvents.length,
          events: timeoutEvents.map(e => ({ id: e.id, from: e.from, to: e.to }))
        }
      });
    }

    // Check for unusual patterns (e.g., agent sending too many messages)
    for (const [agentId, stats] of Object.entries(currentMetrics.messagesByAgent)) {
      const baselineStats = this.baselineMetrics.messagesByAgent[agentId];
      if (baselineStats) {
        const sentIncrease = baselineStats.sent > 0 
          ? ((stats.sent - baselineStats.sent) / baselineStats.sent) * 100
          : stats.sent > 10 ? 1000 : 0; // If baseline had 0, any significant number is unusual

        if (sentIncrease > 500) {
          anomalies.push({
            type: 'unusual_pattern',
            severity: sentIncrease > 1000 ? 'high' : 'medium',
            description: `Agent ${agentId} sending ${sentIncrease.toFixed(0)}% more messages than baseline`,
            timestamp: Date.now(),
            metadata: {
              agentId,
              baselineSent: baselineStats.sent,
              currentSent: stats.sent,
              increase: sentIncrease
            }
          });
        }
      }
    }

    return anomalies;
  }

  /**
   * Updates anomaly detection thresholds
   * @param thresholds - Partial thresholds to update
   */
  updateThresholds(thresholds: Partial<typeof this.thresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }
}

/**
 * Visualization Data Generator
 * Prepares data for UI display
 */
export class VisualizationData {
  private logger: CommunicationLogger;
  private metricsCollector: MetricsCollector;

  constructor(logger: CommunicationLogger, metricsCollector: MetricsCollector) {
    this.logger = logger;
    this.metricsCollector = metricsCollector;
  }

  /**
   * Generates data for communication flow graph
   * @param timeWindow - Time window in milliseconds
   * @returns Graph data with nodes and edges
   */
  generateFlowGraph(timeWindow: number = 300000): {
    nodes: Array<{ id: string; label: string; messageCount: number }>;
    edges: Array<{ from: string; to: string; count: number; avgLatency: number }>;
  } {
    const startTime = Date.now() - timeWindow;
    const events = this.logger.getEvents({ startTime });

    // Collect unique agents
    const agentSet = new Set<string>();
    events.forEach(e => {
      agentSet.add(e.from);
      agentSet.add(e.to);
    });

    // Create nodes
    const nodes = Array.from(agentSet).map(id => {
      const agentEvents = events.filter(e => e.from === id || e.to === id);
      return {
        id,
        label: id,
        messageCount: agentEvents.length
      };
    });

    // Create edges (communication flows)
    const edgeMap = new Map<string, { count: number; totalLatency: number; latencyCount: number }>();
    events.forEach(e => {
      const key = `${e.from}->${e.to}`;
      if (!edgeMap.has(key)) {
        edgeMap.set(key, { count: 0, totalLatency: 0, latencyCount: 0 });
      }
      const edge = edgeMap.get(key)!;
      edge.count++;
      if (e.duration !== undefined) {
        edge.totalLatency += e.duration;
        edge.latencyCount++;
      }
    });

    const edges = Array.from(edgeMap.entries()).map(([key, data]) => {
      const [from, to] = key.split('->');
      return {
        from,
        to,
        count: data.count,
        avgLatency: data.latencyCount > 0 ? data.totalLatency / data.latencyCount : 0
      };
    });

    return { nodes, edges };
  }

  /**
   * Generates time series data for metrics
   * @param interval - Interval in milliseconds
   * @param timeWindow - Time window in milliseconds
   * @returns Time series data points
   */
  generateTimeSeries(interval: number = 10000, timeWindow: number = 300000): Array<{
    timestamp: number;
    metrics: CommunicationMetrics;
  }> {
    const dataPoints: Array<{ timestamp: number; metrics: CommunicationMetrics }> = [];
    const now = Date.now();
    const startTime = now - timeWindow;

    for (let time = startTime; time <= now; time += interval) {
      const metrics = this.metricsCollector.calculateMetrics(time, time + interval);
      dataPoints.push({
        timestamp: time,
        metrics
      });
    }

    return dataPoints;
  }
}

/**
 * Main Communication Monitor
 * Combines all monitoring capabilities
 */
export class CommunicationMonitor {
  public logger: CommunicationLogger;
  public metricsCollector: MetricsCollector;
  public anomalyDetector: AnomalyDetector;
  public visualizationData: VisualizationData;

  constructor() {
    this.logger = new CommunicationLogger();
    this.metricsCollector = new MetricsCollector(this.logger);
    this.anomalyDetector = new AnomalyDetector(this.logger, this.metricsCollector);
    this.visualizationData = new VisualizationData(this.logger, this.metricsCollector);
  }

  /**
   * Logs a communication event
   * @param event - Event to log
   */
  log(event: CommunicationEvent): void {
    this.logger.log(event);
  }

  /**
   * Gets current metrics
   * @returns Communication metrics
   */
  getMetrics(): CommunicationMetrics {
    return this.metricsCollector.getRealTimeMetrics();
  }

  /**
   * Detects anomalies
   * @returns Array of anomalies
   */
  detectAnomalies(): AnomalyResult[] {
    return this.anomalyDetector.detectAnomalies();
  }

  /**
   * Exports all logged data
   * @returns JSON string
   */
  export(): string {
    return this.logger.export();
  }

  /**
   * Clears all monitoring data
   */
  clear(): void {
    this.logger.clear();
  }
}


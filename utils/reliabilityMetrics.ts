/**
 * Reliability Metrics
 * 
 * Tracks and calculates reliability metrics including:
 * - Uptime percentage
 * - Mean Time To Recovery (MTTR)
 * - Mean Time Between Failures (MTBF)
 * - Error rate trends
 * - Reliability score
 */

import { ErrorCode } from './errorHandling';
import { CentralLogger } from './logger';

/**
 * Incident record
 */
export interface Incident {
  id: string;
  startTime: number;
  endTime?: number;
  errorCode: ErrorCode | string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  resolved: boolean;
  recoveryActions?: string[];
}

/**
 * Reliability metrics
 */
export interface ReliabilityMetrics {
  uptimePercentage: number;
  mttr: number;  // Mean Time To Recovery in milliseconds
  mtbf: number;  // Mean Time Between Failures in milliseconds
  errorRate: number;  // Errors per hour
  reliabilityScore: number;  // 0-100 score
  totalIncidents: number;
  resolvedIncidents: number;
  criticalIncidents: number;
  lastIncidentTime?: number;
  trend: 'improving' | 'stable' | 'degrading';
}

/**
 * Time window for metrics calculation
 */
export interface TimeWindow {
  startTime: number;
  endTime: number;
}

/**
 * Reliability Metrics Tracker
 */
export class ReliabilityMetricsTracker {
  private logger: CentralLogger;
  private incidents: Incident[] = [];
  private maxIncidents: number = 1000;
  private systemStartTime: number = Date.now();
  private lastFailureTime?: number;

  constructor(logger: CentralLogger) {
    this.logger = logger;
  }

  /**
   * Record an incident
   */
  recordIncident(
    errorCode: ErrorCode | string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): string {
    const incident: Incident = {
      id: `inc_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      startTime: Date.now(),
      errorCode,
      severity,
      resolved: false
    };

    this.incidents.push(incident);
    this.lastFailureTime = Date.now();

    // Trim incidents if too many
    if (this.incidents.length > this.maxIncidents) {
      this.incidents = this.incidents.slice(-this.maxIncidents);
    }

    this.logger.info(`Incident recorded: ${incident.id}`, {
      errorCode,
      severity
    });

    return incident.id;
  }

  /**
   * Resolve an incident
   */
  resolveIncident(incidentId: string, recoveryActions?: string[]): void {
    const incident = this.incidents.find(inc => inc.id === incidentId);
    if (!incident) {
      this.logger.warn(`Incident not found: ${incidentId}`);
      return;
    }

    incident.endTime = Date.now();
    incident.resolved = true;
    if (recoveryActions) {
      incident.recoveryActions = recoveryActions;
    }

    this.logger.info(`Incident resolved: ${incidentId}`, {
      duration: incident.endTime - incident.startTime,
      recoveryActions
    });
  }

  /**
   * Calculate reliability metrics
   */
  calculateMetrics(timeWindow?: TimeWindow): ReliabilityMetrics {
    const window = timeWindow || {
      startTime: this.systemStartTime,
      endTime: Date.now()
    };

    const windowDuration = window.endTime - window.startTime;
    const windowIncidents = this.incidents.filter(
      inc => inc.startTime >= window.startTime && inc.startTime <= window.endTime
    );

    const resolvedIncidents = windowIncidents.filter(inc => inc.resolved);
    const criticalIncidents = windowIncidents.filter(
      inc => inc.severity === 'critical'
    );

    // Calculate uptime percentage
    const totalDowntime = resolvedIncidents.reduce((sum, inc) => {
      const duration = (inc.endTime || window.endTime) - inc.startTime;
      return sum + duration;
    }, 0);

    const uptimePercentage = windowDuration > 0
      ? Math.max(0, (windowDuration - totalDowntime) / windowDuration * 100)
      : 100;

    // Calculate MTTR (Mean Time To Recovery)
    const recoveryTimes = resolvedIncidents
      .filter(inc => inc.endTime)
      .map(inc => inc.endTime! - inc.startTime);

    const mttr = recoveryTimes.length > 0
      ? recoveryTimes.reduce((sum, time) => sum + time, 0) / recoveryTimes.length
      : 0;

    // Calculate MTBF (Mean Time Between Failures)
    let mtbf = 0;
    if (windowIncidents.length > 1) {
      const intervals: number[] = [];
      for (let i = 1; i < windowIncidents.length; i++) {
        intervals.push(windowIncidents[i].startTime - windowIncidents[i - 1].startTime);
      }
      mtbf = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    } else if (windowIncidents.length === 1) {
      mtbf = window.endTime - windowIncidents[0].startTime;
    } else {
      mtbf = windowDuration;
    }

    // Calculate error rate (errors per hour)
    const hoursInWindow = windowDuration / (1000 * 60 * 60);
    const errorRate = hoursInWindow > 0
      ? windowIncidents.length / hoursInWindow
      : 0;

    // Calculate reliability score (0-100)
    // Higher score = more reliable
    const reliabilityScore = this.calculateReliabilityScore({
      uptimePercentage,
      mttr,
      mtbf,
      errorRate,
      criticalIncidents: criticalIncidents.length,
      resolvedIncidents: resolvedIncidents.length,
      totalIncidents: windowIncidents.length
    });

    // Determine trend
    const trend = this.calculateTrend();

    return {
      uptimePercentage: Math.round(uptimePercentage * 100) / 100,
      mttr: Math.round(mttr),
      mtbf: Math.round(mtbf),
      errorRate: Math.round(errorRate * 100) / 100,
      reliabilityScore: Math.round(reliabilityScore),
      totalIncidents: windowIncidents.length,
      resolvedIncidents: resolvedIncidents.length,
      criticalIncidents: criticalIncidents.length,
      lastIncidentTime: this.lastFailureTime,
      trend
    };
  }

  /**
   * Calculate reliability score
   */
  private calculateReliabilityScore(data: {
    uptimePercentage: number;
    mttr: number;
    mtbf: number;
    errorRate: number;
    criticalIncidents: number;
    resolvedIncidents: number;
    totalIncidents: number;
  }): number {
    let score = 100;

    // Uptime impact (40% weight)
    const uptimeScore = (data.uptimePercentage / 100) * 40;
    score = Math.min(score, uptimeScore + 60);  // Can still get 60 points from other factors

    // MTTR impact (20% weight)
    // Lower MTTR is better
    // Assuming ideal MTTR is < 1000ms, max is 60000ms
    const mttrScore = Math.max(0, 20 - (data.mttr / 60000) * 20);
    score = score * 0.8 + mttrScore * 0.2;

    // MTBF impact (20% weight)
    // Higher MTBF is better
    // Assuming ideal MTBF is > 3600000ms (1 hour), min is 60000ms
    const mtbfNormalized = Math.min(1, (data.mtbf - 60000) / 3540000);
    const mtbfScore = mtbfNormalized * 20;
    score = score * 0.8 + mtbfScore * 0.2;

    // Error rate impact (10% weight)
    // Lower error rate is better
    const errorRateScore = Math.max(0, 10 - (data.errorRate / 10) * 10);
    score = score * 0.9 + errorRateScore * 0.1;

    // Critical incidents penalty (10% weight)
    const criticalPenalty = Math.min(10, data.criticalIncidents * 2);
    score = Math.max(0, score - criticalPenalty);

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate trend (improving, stable, degrading)
   */
  private calculateTrend(): 'improving' | 'stable' | 'degrading' {
    if (this.incidents.length < 2) return 'stable';

    const recentWindow = {
      startTime: Date.now() - 3600000,  // Last hour
      endTime: Date.now()
    };

    const olderWindow = {
      startTime: Date.now() - 7200000,  // Hour before that
      endTime: Date.now() - 3600000
    };

    const recentMetrics = this.calculateMetrics(recentWindow);
    const olderMetrics = this.calculateMetrics(olderWindow);

    const recentScore = recentMetrics.reliabilityScore;
    const olderScore = olderMetrics.reliabilityScore;

    const difference = recentScore - olderScore;

    if (difference > 5) return 'improving';
    if (difference < -5) return 'degrading';
    return 'stable';
  }

  /**
   * Get incident history
   */
  getIncidentHistory(limit: number = 50): Incident[] {
    return this.incidents.slice(-limit).reverse();
  }

  /**
   * Get unresolved incidents
   */
  getUnresolvedIncidents(): Incident[] {
    return this.incidents.filter(inc => !inc.resolved);
  }

  /**
   * Reset metrics (use with caution)
   */
  reset(): void {
    this.incidents = [];
    this.systemStartTime = Date.now();
    this.lastFailureTime = undefined;
    this.logger.info('Reliability metrics reset');
  }
}


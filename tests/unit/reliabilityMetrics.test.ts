/**
 * Unit tests for Reliability Metrics
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ReliabilityMetricsTracker, ReliabilityMetrics } from '../../utils/reliabilityMetrics';
import { CentralLogger } from '../../utils/logger';
import { ErrorCode } from '../../utils/errorHandling';

describe('Reliability Metrics Tracker', () => {
  let tracker: ReliabilityMetricsTracker;
  let logger: CentralLogger;

  beforeEach(() => {
    logger = new CentralLogger('info');
    tracker = new ReliabilityMetricsTracker(logger);
  });

  it('should record incidents', () => {
    const incidentId = tracker.recordIncident(ErrorCode.NETWORK_ERROR, 'medium');
    expect(incidentId).toBeDefined();
    expect(incidentId.startsWith('inc_')).toBe(true);
  });

  it('should resolve incidents', () => {
    const incidentId = tracker.recordIncident(ErrorCode.NETWORK_ERROR, 'medium');
    tracker.resolveIncident(incidentId, ['restart_service']);

    const incidents = tracker.getIncidentHistory(10);
    const incident = incidents.find(inc => inc.id === incidentId);
    
    expect(incident).toBeDefined();
    expect(incident?.resolved).toBe(true);
    expect(incident?.recoveryActions).toEqual(['restart_service']);
  });

  it('should calculate reliability metrics', () => {
    // Record and resolve some incidents
    const incident1 = tracker.recordIncident(ErrorCode.NETWORK_ERROR, 'low');
    const incident2 = tracker.recordIncident(ErrorCode.EXTERNAL_API_FAILURE, 'high');
    const incident3 = tracker.recordIncident(ErrorCode.DATABASE_ERROR, 'critical');

    tracker.resolveIncident(incident1);
    tracker.resolveIncident(incident2);
    // Don't resolve incident3

    const metrics = tracker.calculateMetrics();
    
    expect(metrics.totalIncidents).toBe(3);
    expect(metrics.resolvedIncidents).toBe(2);
    expect(metrics.criticalIncidents).toBe(1);
    expect(metrics.reliabilityScore).toBeGreaterThanOrEqual(0);
    expect(metrics.reliabilityScore).toBeLessThanOrEqual(100);
  });

  it('should calculate uptime percentage', () => {
    const incident = tracker.recordIncident(ErrorCode.NETWORK_ERROR, 'medium');
    
    // Wait a bit
    const waitTime = 100;
    setTimeout(() => {
      tracker.resolveIncident(incident);
    }, waitTime);

    // Calculate metrics after resolution
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const metrics = tracker.calculateMetrics();
        expect(metrics.uptimePercentage).toBeGreaterThanOrEqual(0);
        expect(metrics.uptimePercentage).toBeLessThanOrEqual(100);
        resolve();
      }, waitTime + 50);
    });
  });

  it('should calculate MTTR', () => {
    const incident1 = tracker.recordIncident(ErrorCode.NETWORK_ERROR, 'medium');
    
    setTimeout(() => {
      tracker.resolveIncident(incident1);
    }, 200);

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const metrics = tracker.calculateMetrics();
        expect(metrics.mttr).toBeGreaterThan(0);
        resolve();
      }, 300);
    });
  });

  it('should calculate MTBF', () => {
    const incident1 = tracker.recordIncident(ErrorCode.NETWORK_ERROR, 'medium');
    
    setTimeout(() => {
      tracker.resolveIncident(incident1);
      const incident2 = tracker.recordIncident(ErrorCode.EXTERNAL_API_FAILURE, 'medium');
      setTimeout(() => {
        tracker.resolveIncident(incident2);
      }, 100);
    }, 100);

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const metrics = tracker.calculateMetrics();
        expect(metrics.mtbf).toBeGreaterThan(0);
        resolve();
      }, 300);
    });
  });

  it('should determine trend', () => {
    // Create incidents over time
    const incident1 = tracker.recordIncident(ErrorCode.NETWORK_ERROR, 'medium');
    tracker.resolveIncident(incident1);

    // Wait and create more incidents
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const incident2 = tracker.recordIncident(ErrorCode.NETWORK_ERROR, 'medium');
        tracker.resolveIncident(incident2);

        const metrics = tracker.calculateMetrics();
        expect(['improving', 'stable', 'degrading']).toContain(metrics.trend);
        resolve();
      }, 200);
    });
  });

  it('should get unresolved incidents', () => {
    const incident1 = tracker.recordIncident(ErrorCode.NETWORK_ERROR, 'medium');
    const incident2 = tracker.recordIncident(ErrorCode.EXTERNAL_API_FAILURE, 'high');
    
    tracker.resolveIncident(incident1);

    const unresolved = tracker.getUnresolvedIncidents();
    expect(unresolved.length).toBe(1);
    expect(unresolved[0].id).toBe(incident2);
  });

  it('should get incident history', () => {
    tracker.recordIncident(ErrorCode.NETWORK_ERROR, 'medium');
    tracker.recordIncident(ErrorCode.EXTERNAL_API_FAILURE, 'high');

    const history = tracker.getIncidentHistory(10);
    expect(history.length).toBeGreaterThanOrEqual(2);
  });

  it('should reset metrics', () => {
    tracker.recordIncident(ErrorCode.NETWORK_ERROR, 'medium');
    tracker.reset();

    const metrics = tracker.calculateMetrics();
    expect(metrics.totalIncidents).toBe(0);
  });
});


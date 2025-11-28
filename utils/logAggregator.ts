/**
 * Log Aggregator
 * 
 * Aggregates logs from multiple sources and provides unified querying
 */

import { CentralLogger, LogEntry, LogQueryFilters } from './logger';

/**
 * Log source
 */
export interface LogSource {
  name: string;
  logger: CentralLogger;
  enabled: boolean;
}

/**
 * Log Aggregator
 */
export class LogAggregator {
  private sources: LogSource[] = [];
  private aggregatedLogs: LogEntry[] = [];
  private maxAggregatedLogs: number = 50000;

  /**
   * Add log source
   */
  addSource(source: LogSource): void {
    this.sources.push(source);
  }

  /**
   * Remove log source
   */
  removeSource(name: string): void {
    this.sources = this.sources.filter(s => s.name !== name);
  }

  /**
   * Aggregate logs from all sources
   */
  async aggregateLogs(filters?: LogQueryFilters): Promise<LogEntry[]> {
    const allLogs: LogEntry[] = [];

    for (const source of this.sources) {
      if (!source.enabled) continue;

      try {
        const logs = await source.logger.queryLogs(filters || {});
        // Add source name to logs
        const enrichedLogs = logs.map(log => ({
          ...log,
          source: source.name
        }));
        allLogs.push(...enrichedLogs);
      } catch (error) {
        console.error(`Error aggregating logs from ${source.name}:`, error);
      }
    }

    // Sort by timestamp
    allLogs.sort((a, b) => a.timestamp - b.timestamp);

    // Store aggregated logs
    this.aggregatedLogs = allLogs.slice(-this.maxAggregatedLogs);

    return allLogs;
  }

  /**
   * Query aggregated logs
   */
  async queryAggregatedLogs(filters: LogQueryFilters & { source?: string }): Promise<LogEntry[]> {
    // If no aggregation yet, aggregate first
    if (this.aggregatedLogs.length === 0) {
      await this.aggregateLogs();
    }

    let results = [...this.aggregatedLogs];

    // Apply filters
    if (filters.source) {
      results = results.filter(l => (l as any).source === filters.source);
    }
    if (filters.sessionId) {
      results = results.filter(l => l.sessionId === filters.sessionId);
    }
    if (filters.level) {
      results = results.filter(l => l.level === filters.level);
    }
    if (filters.startTime) {
      results = results.filter(l => l.timestamp >= filters.startTime!);
    }
    if (filters.endTime) {
      results = results.filter(l => l.timestamp <= filters.endTime!);
    }
    if (filters.limit) {
      results = results.slice(0, filters.limit);
    }

    return results;
  }

  /**
   * Export logs
   */
  async exportLogs(filters?: LogQueryFilters): Promise<string> {
    const logs = await this.aggregateLogs(filters);
    return JSON.stringify(logs, null, 2);
  }

  /**
   * Get log statistics by source
   */
  async getLogStatistics(): Promise<Record<string, {
    total: number;
    byLevel: Record<string, number>;
    byType: Record<string, number>;
  }>> {
    const stats: Record<string, any> = {};

    for (const source of this.sources) {
      if (!source.enabled) continue;

      const logs = await source.logger.queryLogs({});
      
      const byLevel: Record<string, number> = {};
      const byType: Record<string, number> = {};

      for (const log of logs) {
        byLevel[log.level] = (byLevel[log.level] || 0) + 1;
        byType[log.type] = (byType[log.type] || 0) + 1;
      }

      stats[source.name] = {
        total: logs.length,
        byLevel,
        byType
      };
    }

    return stats;
  }

  /**
   * Start periodic aggregation
   */
  startPeriodicAggregation(intervalMs: number = 60000): NodeJS.Timeout {
    return setInterval(() => {
      this.aggregateLogs().catch(error => {
        console.error('Error in periodic log aggregation:', error);
      });
    }, intervalMs);
  }
}


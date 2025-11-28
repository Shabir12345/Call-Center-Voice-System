/**
 * Optimization Utilities
 * 
 * Utilities for profiling, optimizing, and improving system performance
 */

import { PerformanceMonitor, PerformanceMetrics } from './performanceMonitor';
import { CentralLogger } from './logger';
import { CacheManagerFactory } from './cacheManager';

/**
 * Performance profile
 */
export interface PerformanceProfile {
  component: string;
  averageTime: number;
  callCount: number;
  totalTime: number;
  percentage: number;
}

/**
 * Optimization recommendations
 */
export interface OptimizationRecommendation {
  type: 'cache' | 'timeout' | 'parallel' | 'batch' | 'reduce';
  component: string;
  description: string;
  impact: 'low' | 'medium' | 'high';
  effort: 'low' | 'medium' | 'high';
}

/**
 * Performance Optimizer
 */
export class PerformanceOptimizer {
  private performanceMonitor: PerformanceMonitor;
  private logger: CentralLogger;

  constructor(performanceMonitor: PerformanceMonitor, logger: CentralLogger) {
    this.performanceMonitor = performanceMonitor;
    this.logger = logger;
  }

  /**
   * Profile system performance
   */
  profilePerformance(): PerformanceProfile[] {
    const metrics = this.performanceMonitor.getMetrics();
    const profiles: PerformanceProfile[] = [];
    const totalTime = metrics.responseTime.average * metrics.throughput.totalRequests;

    // Profile by agent
    for (const [agentId, agentMetrics] of Object.entries(metrics.agentMetrics)) {
      const agentTime = agentMetrics.averageResponseTime * agentMetrics.requestCount;
      profiles.push({
        component: agentId,
        averageTime: agentMetrics.averageResponseTime,
        callCount: agentMetrics.requestCount,
        totalTime: agentTime,
        percentage: totalTime > 0 ? (agentTime / totalTime) * 100 : 0
      });
    }

    // Sort by total time
    profiles.sort((a, b) => b.totalTime - a.totalTime);

    return profiles;
  }

  /**
   * Generate optimization recommendations
   */
  generateRecommendations(): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = [];
    const metrics = this.performanceMonitor.getMetrics();
    const profiles = this.profilePerformance();

    // Check for slow agents
    for (const profile of profiles) {
      if (profile.averageTime > 2000) {
        recommendations.push({
          type: 'cache',
          component: profile.component,
          description: `Agent ${profile.component} has high average response time (${profile.averageTime}ms). Consider caching responses.`,
          impact: 'high',
          effort: 'low'
        });
      }
    }

    // Check error rate
    if (metrics.errorRate.percentage > 5) {
      recommendations.push({
        type: 'reduce',
        component: 'system',
        description: `High error rate (${metrics.errorRate.percentage.toFixed(2)}%). Review error handling and retry logic.`,
        impact: 'high',
        effort: 'medium'
      });
    }

    // Check response times
    if (metrics.responseTime.p95 > 5000) {
      recommendations.push({
        type: 'timeout',
        component: 'system',
        description: `P95 response time is high (${metrics.responseTime.p95}ms). Consider optimizing slow paths.`,
        impact: 'medium',
        effort: 'medium'
      });
    }

    // Check throughput
    if (metrics.throughput.requestsPerSecond < 1) {
      recommendations.push({
        type: 'parallel',
        component: 'system',
        description: 'Low throughput. Consider parallel processing.',
        impact: 'high',
        effort: 'high'
      });
    }

    return recommendations;
  }

  /**
   * Optimize cache configuration
   */
  optimizeCacheConfig(): {
    cacheName: string;
    recommendedSize: number;
    recommendedTTL: number;
  }[] {
    const recommendations: Array<{
      cacheName: string;
      recommendedSize: number;
      recommendedTTL: number;
    }> = [];

    const allStats = CacheManagerFactory.getAllStats();

    for (const [cacheName, stats] of Object.entries(allStats)) {
      // If hit rate is low, increase size
      if (stats.hitRate < 50) {
        recommendations.push({
          cacheName,
          recommendedSize: stats.size * 2,
          recommendedTTL: 3600000 // 1 hour
        });
      }

      // If hit rate is high but size is small, can increase
      if (stats.hitRate > 80 && stats.size < 100) {
        recommendations.push({
          cacheName,
          recommendedSize: Math.min(stats.size * 2, 1000),
          recommendedTTL: 7200000 // 2 hours
        });
      }
    }

    return recommendations;
  }

  /**
   * Get hot paths (most called components)
   */
  getHotPaths(limit: number = 10): PerformanceProfile[] {
    const profiles = this.profilePerformance();
    return profiles.slice(0, limit);
  }

  /**
   * Get bottlenecks (slowest components)
   */
  getBottlenecks(limit: number = 10): PerformanceProfile[] {
    const profiles = this.profilePerformance();
    return profiles
      .filter(p => p.averageTime > 1000)
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, limit);
  }
}


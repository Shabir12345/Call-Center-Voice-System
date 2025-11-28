/**
 * System Status Panel
 * 
 * Lightweight panel that displays high-level system health, performance,
 * and analytics metrics from PerformanceMonitor, HealthChecker, and AnalyticsManager.
 */

import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, AlertTriangle, CheckCircle2, Clock, Zap, BarChart3, Heart, Cpu } from 'lucide-react';
import { PerformanceMonitor, PerformanceMetrics } from '../utils/performanceMonitor';
import { HealthChecker, HealthReport } from '../utils/healthChecker';
import { AnalyticsManager, UsageMetrics } from '../utils/analytics';

interface SystemStatusPanelProps {
  performanceMonitor?: PerformanceMonitor;
  healthChecker?: HealthChecker;
  analyticsManager?: AnalyticsManager;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

interface SystemMetrics {
  health: HealthReport | null;
  performance: PerformanceMetrics | null;
  analytics: UsageMetrics | null;
  timestamp: number;
}

const SystemStatusPanel: React.FC<SystemStatusPanelProps> = ({
  performanceMonitor,
  healthChecker,
  analyticsManager,
  autoRefresh = true,
  refreshInterval = 5000
}) => {
  const [metrics, setMetrics] = useState<SystemMetrics>({
    health: null,
    performance: null,
    analytics: null,
    timestamp: Date.now()
  });
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const fetchMetrics = async () => {
      const newMetrics: SystemMetrics = {
        health: null,
        performance: null,
        analytics: null,
        timestamp: Date.now()
      };

      try {
        if (healthChecker) {
          newMetrics.health = await healthChecker.checkHealth();
        }
      } catch (error) {
        console.error('Failed to fetch health metrics:', error);
      }

      try {
        if (performanceMonitor) {
          newMetrics.performance = performanceMonitor.getMetrics();
        }
      } catch (error) {
        console.error('Failed to fetch performance metrics:', error);
      }

      try {
        if (analyticsManager) {
          newMetrics.analytics = analyticsManager.getUsageMetrics();
        }
      } catch (error) {
        console.error('Failed to fetch analytics metrics:', error);
      }

      setMetrics(newMetrics);
    };

    // Initial fetch
    fetchMetrics();

    // Auto-refresh if enabled
    if (autoRefresh) {
      const interval = setInterval(fetchMetrics, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [healthChecker, performanceMonitor, analyticsManager, autoRefresh, refreshInterval]);

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'degraded':
        return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'unhealthy':
        return 'text-rose-600 bg-rose-50 border-rose-200';
      default:
        return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 size={14} className="text-emerald-600" />;
      case 'degraded':
        return <AlertTriangle size={14} className="text-amber-600" />;
      case 'unhealthy':
        return <AlertTriangle size={14} className="text-rose-600" />;
      default:
        return <Activity size={14} className="text-slate-400" />;
    }
  };

  return (
    <div className="bg-white border-b border-slate-200">
      {/* Compact Header */}
      <div 
        className="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-50 rounded-md">
            <Activity size={14} className="text-indigo-600" />
          </div>
          <span className="text-xs font-bold text-slate-700">System Status</span>
          {metrics.health && (
            <div className={`px-2 py-0.5 rounded-full text-[10px] font-medium border flex items-center gap-1 ${getHealthStatusColor(metrics.health.overall)}`}>
              {getHealthStatusIcon(metrics.health.overall)}
              <span className="uppercase">{metrics.health.overall}</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 text-[10px] text-slate-400">
          {metrics.performance && (
            <div className="flex items-center gap-1">
              <Clock size={10} />
              <span>{metrics.performance.averageResponseTime?.toFixed(0) || 0}ms</span>
            </div>
          )}
          {metrics.analytics && (
            <div className="flex items-center gap-1">
              <Zap size={10} />
              <span>{metrics.analytics.totalRequests || 0}</span>
            </div>
          )}
        </div>
      </div>

      {/* Expanded Details */}
      {isExpanded && (
        <div className="px-4 pb-3 space-y-3 border-t border-slate-100 bg-slate-50/50">
          {/* Health Status */}
          {metrics.health && (
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Heart size={12} className="text-rose-500" />
                  <span className="text-xs font-bold text-slate-700">Health</span>
                </div>
                <div className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${getHealthStatusColor(metrics.health.overall)}`}>
                  {metrics.health.overall.toUpperCase()}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div className="text-center">
                  <div className="text-emerald-600 font-bold">{metrics.health.summary.healthy}</div>
                  <div className="text-slate-500">Healthy</div>
                </div>
                <div className="text-center">
                  <div className="text-amber-600 font-bold">{metrics.health.summary.degraded}</div>
                  <div className="text-slate-500">Degraded</div>
                </div>
                <div className="text-center">
                  <div className="text-rose-600 font-bold">{metrics.health.summary.unhealthy}</div>
                  <div className="text-slate-500">Unhealthy</div>
                </div>
              </div>
            </div>
          )}

          {/* Performance Metrics */}
          {metrics.performance && (
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <Cpu size={12} className="text-indigo-500" />
                <span className="text-xs font-bold text-slate-700">Performance</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-[10px]">
                <div>
                  <div className="text-slate-500 mb-0.5">Avg Response</div>
                  <div className="text-slate-700 font-bold">{metrics.performance.averageResponseTime?.toFixed(0) || 0}ms</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-0.5">P95 Latency</div>
                  <div className="text-slate-700 font-bold">{metrics.performance.p95Latency?.toFixed(0) || 0}ms</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-0.5">Throughput</div>
                  <div className="text-slate-700 font-bold">{metrics.performance.requestsPerSecond?.toFixed(1) || 0}/s</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-0.5">Error Rate</div>
                  <div className="text-slate-700 font-bold">{(metrics.performance.errorRate || 0).toFixed(1)}%</div>
                </div>
              </div>
            </div>
          )}

          {/* Analytics Metrics */}
          {metrics.analytics && (
            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 size={12} className="text-purple-500" />
                <span className="text-xs font-bold text-slate-700">Analytics</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-[10px]">
                <div>
                  <div className="text-slate-500 mb-0.5">Total Requests</div>
                  <div className="text-slate-700 font-bold">{metrics.analytics.totalRequests || 0}</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-0.5">Success Rate</div>
                  <div className="text-slate-700 font-bold">{(metrics.analytics.successRate || 0).toFixed(1)}%</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-0.5">Active Sessions</div>
                  <div className="text-slate-700 font-bold">{metrics.analytics.activeSessions || 0}</div>
                </div>
                <div>
                  <div className="text-slate-500 mb-0.5">Avg Session</div>
                  <div className="text-slate-700 font-bold">{metrics.analytics.averageSessionDuration?.toFixed(0) || 0}s</div>
                </div>
              </div>
            </div>
          )}

          {/* Last Updated */}
          <div className="text-[9px] text-slate-400 text-center">
            Last updated: {new Date(metrics.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemStatusPanel;


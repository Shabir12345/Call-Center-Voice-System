/**
 * Observability Panel Component
 * 
 * Real-time observability dashboard showing performance, health, analytics, and tracing.
 * Integrates all observability tools into a single UI component.
 */

import React, { useState, useEffect } from 'react';
import { Activity, Heart, TrendingUp, AlertTriangle, Clock, Zap, BarChart3, Layers, ArrowRightLeft, Eye, Server } from 'lucide-react';
import { PerformanceMonitor, PerformanceMetrics } from '../utils/performanceMonitor';
import { HealthChecker, HealthReport } from '../utils/healthChecker';
import { AnalyticsManager, UsageMetrics } from '../utils/analytics';
import { Tracer, TraceSpan } from '../utils/tracing';
import { ReliabilityMetricsTracker, ReliabilityMetrics } from '../utils/reliabilityMetrics';
import { CentralLogger } from '../utils/logger';

interface ObservabilityPanelProps {
  performanceMonitor?: PerformanceMonitor;
  healthChecker?: HealthChecker;
  analyticsManager?: AnalyticsManager;
  tracer?: Tracer;
  reliabilityTracker?: ReliabilityMetricsTracker;
  logger?: CentralLogger;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const ObservabilityPanel: React.FC<ObservabilityPanelProps> = ({
  performanceMonitor,
  healthChecker,
  analyticsManager,
  tracer,
  reliabilityTracker,
  logger,
  autoRefresh = true,
  refreshInterval = 5000
}) => {
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [usage, setUsage] = useState<UsageMetrics | null>(null);
  const [reliability, setReliability] = useState<ReliabilityMetrics | null>(null);
  const [activeTraces, setActiveTraces] = useState<TraceSpan[]>([]);
  const [selectedTab, setSelectedTab] = useState<'performance' | 'health' | 'analytics' | 'traces' | 'reliability'>('performance');

  useEffect(() => {
    const refreshData = async () => {
      if (performanceMonitor) {
        setPerformance(performanceMonitor.getMetrics());
      }
      if (healthChecker) {
        const healthReport = await healthChecker.checkHealth();
        setHealth(healthReport);
      }
      if (analyticsManager) {
        setUsage(analyticsManager.getUsageMetrics());
      }
      if (reliabilityTracker) {
        setReliability(reliabilityTracker.calculateMetrics());
      }
      if (tracer) {
        // Get recent traces (active + completed)
        const recentTraces = tracer.getRecentTraces(20);
        setActiveTraces(recentTraces);
      }
    };

    refreshData();
    
    if (autoRefresh) {
      const interval = setInterval(refreshData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [performanceMonitor, healthChecker, analyticsManager, tracer, reliabilityTracker, autoRefresh, refreshInterval]);

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-50 border-green-200';
      case 'degraded': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'unhealthy': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const getReliabilityColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 bg-slate-50">
        <button
          onClick={() => setSelectedTab('performance')}
          className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
            selectedTab === 'performance'
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Activity size={14} />
            <span>Performance</span>
          </div>
        </button>
        <button
          onClick={() => setSelectedTab('health')}
          className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
            selectedTab === 'health'
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Heart size={14} />
            <span>Health</span>
          </div>
        </button>
        <button
          onClick={() => setSelectedTab('analytics')}
          className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
            selectedTab === 'analytics'
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <TrendingUp size={14} />
            <span>Analytics</span>
          </div>
        </button>
        <button
          onClick={() => setSelectedTab('reliability')}
          className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
            selectedTab === 'reliability'
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Zap size={14} />
            <span>Reliability</span>
          </div>
        </button>
        <button
          onClick={() => setSelectedTab('traces')}
          className={`flex-1 px-4 py-2 text-xs font-medium transition-colors ${
            selectedTab === 'traces'
              ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <div className="flex items-center justify-center gap-1.5">
            <Layers size={14} />
            <span>Traces</span>
          </div>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Performance Tab */}
        {selectedTab === 'performance' && performance && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <Clock size={14} className="text-indigo-600" />
                  <span className="text-xs font-semibold text-slate-700">Avg Response Time</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {performance.responseTime.average.toFixed(0)}ms
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  P95: {performance.responseTime.p95.toFixed(0)}ms
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <Activity size={14} className="text-green-600" />
                  <span className="text-xs font-semibold text-slate-700">Throughput</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {performance.throughput.requestsPerSecond.toFixed(1)}/s
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Total: {performance.throughput.totalRequests}
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={14} className="text-red-600" />
                  <span className="text-xs font-semibold text-slate-700">Error Rate</span>
                </div>
                <div className="text-2xl font-bold text-red-600">
                  {performance.errorRate.percentage.toFixed(2)}%
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {performance.errorRate.total} errors
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="flex items-center gap-2 mb-2">
                  <Server size={14} className="text-purple-600" />
                  <span className="text-xs font-semibold text-slate-700">Agents</span>
                </div>
                <div className="text-2xl font-bold text-slate-900">
                  {Object.keys(performance.agentMetrics).length}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Active agents
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Health Tab */}
        {selectedTab === 'health' && health && (
          <div className="space-y-4">
            <div className={`p-4 rounded-lg border-2 ${getHealthColor(health.overall)}`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold uppercase">Overall Health</span>
                <Heart size={20} className={health.overall === 'healthy' ? 'text-green-600' : health.overall === 'degraded' ? 'text-yellow-600' : 'text-red-600'} />
              </div>
              <div className="text-3xl font-bold capitalize">{health.overall}</div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                <div className="text-xs text-green-700 font-semibold">Healthy</div>
                <div className="text-xl font-bold text-green-600">{health.summary.healthy}</div>
              </div>
              <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                <div className="text-xs text-yellow-700 font-semibold">Degraded</div>
                <div className="text-xl font-bold text-yellow-600">{health.summary.degraded}</div>
              </div>
              <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                <div className="text-xs text-red-700 font-semibold">Unhealthy</div>
                <div className="text-xl font-bold text-red-600">{health.summary.unhealthy}</div>
              </div>
            </div>

            {health.components && health.components.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide">Components</div>
                {health.components.map((component, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
                    <span className="text-sm font-medium text-slate-700">{component.name}</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${getHealthColor(component.status)}`}>
                      {component.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {selectedTab === 'analytics' && usage && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="text-xs font-semibold text-slate-700 mb-2">Total Sessions</div>
                <div className="text-2xl font-bold text-slate-900">{usage.totalSessions}</div>
                <div className="text-xs text-slate-500 mt-1">Active: {usage.activeSessions}</div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="text-xs font-semibold text-slate-700 mb-2">Avg Messages/Session</div>
                <div className="text-2xl font-bold text-slate-900">{usage.averageMessagesPerSession.toFixed(1)}</div>
                <div className="text-xs text-slate-500 mt-1">Total: {usage.totalMessages}</div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="text-xs font-semibold text-slate-700 mb-2">Success Rate</div>
                <div className="text-2xl font-bold text-green-600">{(usage.successRate * 100).toFixed(1)}%</div>
                <div className="text-xs text-slate-500 mt-1">Error: {(usage.errorRate * 100).toFixed(1)}%</div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="text-xs font-semibold text-slate-700 mb-2">Avg Session Duration</div>
                <div className="text-2xl font-bold text-slate-900">{Math.round(usage.averageSessionDuration / 1000)}s</div>
              </div>
            </div>

            {usage.topIntents && usage.topIntents.length > 0 && (
              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-700 uppercase tracking-wide mb-2">Top Intents</div>
                <div className="space-y-2">
                  {usage.topIntents.slice(0, 5).map((intent, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded border border-slate-200">
                      <span className="text-sm text-slate-700">{intent.intent}</span>
                      <span className="text-sm font-bold text-indigo-600">{intent.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reliability Tab */}
        {selectedTab === 'reliability' && reliability && (
          <div className="space-y-4">
            <div className={`p-4 rounded-lg border-2 ${getReliabilityColor(reliability.reliabilityScore)} bg-white`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-bold uppercase text-slate-700">Reliability Score</span>
                <Zap size={20} className={getReliabilityColor(reliability.reliabilityScore)} />
              </div>
              <div className={`text-4xl font-bold ${getReliabilityColor(reliability.reliabilityScore)}`}>
                {reliability.reliabilityScore}/100
              </div>
              <div className="text-xs text-slate-500 mt-1 capitalize">Trend: {reliability.trend}</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="text-xs font-semibold text-slate-700 mb-2">Uptime</div>
                <div className="text-2xl font-bold text-green-600">{reliability.uptimePercentage.toFixed(2)}%</div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="text-xs font-semibold text-slate-700 mb-2">MTTR</div>
                <div className="text-2xl font-bold text-slate-900">{(reliability.mttr / 1000).toFixed(1)}s</div>
                <div className="text-xs text-slate-500 mt-1">Mean Time To Recovery</div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="text-xs font-semibold text-slate-700 mb-2">MTBF</div>
                <div className="text-2xl font-bold text-slate-900">{(reliability.mtbf / 1000).toFixed(0)}s</div>
                <div className="text-xs text-slate-500 mt-1">Mean Time Between Failures</div>
              </div>

              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div className="text-xs font-semibold text-slate-700 mb-2">Error Rate</div>
                <div className="text-2xl font-bold text-red-600">{reliability.errorRate.toFixed(2)}/hr</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <div className="text-xs text-slate-700 font-semibold">Incidents</div>
                <div className="text-xl font-bold text-slate-900">{reliability.totalIncidents}</div>
              </div>
              <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                <div className="text-xs text-green-700 font-semibold">Resolved</div>
                <div className="text-xl font-bold text-green-600">{reliability.resolvedIncidents}</div>
              </div>
              <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                <div className="text-xs text-red-700 font-semibold">Critical</div>
                <div className="text-xl font-bold text-red-600">{reliability.criticalIncidents}</div>
              </div>
            </div>
          </div>
        )}

        {/* Traces Tab */}
        {selectedTab === 'traces' && (
          <div className="space-y-4">
            {activeTraces.length === 0 ? (
              <div className="text-center text-slate-400 py-8 text-sm">
                <Layers size={24} className="mx-auto mb-2 opacity-50" />
                <div>No active traces</div>
                <div className="text-xs mt-1">Traces will appear here as requests are processed</div>
              </div>
            ) : (
              <div className="space-y-2">
                {activeTraces.map((trace, idx) => {
                  const duration = trace.duration || (trace.endTime || Date.now()) - trace.startTime;
                  const isActive = !trace.endTime;
                  const service = trace.tags?.service || trace.tags?.agentId || 'system';
                  
                  return (
                    <div 
                      key={trace.spanId || idx} 
                      className={`p-3 rounded-lg border ${
                        isActive 
                          ? 'bg-indigo-50 border-indigo-200' 
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-slate-700">{trace.operation}</span>
                          {isActive && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded font-medium">
                              ACTIVE
                            </span>
                          )}
                        </div>
                        <span className={`text-xs font-medium ${
                          duration > 5000 ? 'text-red-600' : duration > 2000 ? 'text-yellow-600' : 'text-slate-500'
                        }`}>
                          {duration.toFixed(0)}ms
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500">
                        <span>Service: {service}</span>
                        {trace.traceId && (
                          <span className="font-mono text-[10px]">Trace: {trace.traceId.substring(0, 8)}...</span>
                        )}
                      </div>
                      {trace.tags && Object.keys(trace.tags).length > 0 && (
                        <div className="mt-2 pt-2 border-t border-slate-200">
                          <div className="text-[10px] text-slate-400">
                            Tags: {Object.entries(trace.tags).slice(0, 3).map(([k, v]) => `${k}=${v}`).join(', ')}
                            {Object.keys(trace.tags).length > 3 && '...'}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* No Data State */}
        {!performance && !health && !usage && !reliability && selectedTab !== 'traces' && (
          <div className="text-center text-slate-400 py-8 text-sm">
            <Eye size={24} className="mx-auto mb-2 opacity-50" />
            <div>No observability data available</div>
            <div className="text-xs mt-1">Connect observability tools to see metrics</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ObservabilityPanel;


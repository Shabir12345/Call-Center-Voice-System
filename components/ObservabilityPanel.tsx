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
import { DashboardProvider } from '../utils/dashboard';

interface ObservabilityPanelProps {
  performanceMonitor?: PerformanceMonitor;
  healthChecker?: HealthChecker;
  analyticsManager?: AnalyticsManager;
  tracer?: Tracer;
  reliabilityTracker?: ReliabilityMetricsTracker;
  logger?: CentralLogger;
  dashboardProvider?: DashboardProvider; // Optional DashboardProvider for event-based updates (Phase 3.4)
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
  dashboardProvider,
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
      if (dashboardProvider) {
        // Use DashboardProvider if available (event-based updates)
        const dashboardData = await dashboardProvider.getDashboardData();
        setPerformance(dashboardData.performance);
        setHealth(dashboardData.health);
        setUsage(dashboardData.usage);
        if (dashboardData.reliability) {
          setReliability(dashboardData.reliability);
        }
      } else {
        // Fallback to individual tools if DashboardProvider not provided
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
      }
      
      if (tracer) {
        // Get recent traces (active + completed)
        const recentTraces = tracer.getRecentTraces(20);
        setActiveTraces(recentTraces);
      }
    };

    refreshData();
    
    // Subscribe to DashboardProvider events for real-time updates (Phase 3.4)
    let unsubscribe: (() => void) | null = null;
    if (dashboardProvider) {
      unsubscribe = dashboardProvider.on('*', async (event) => {
        if (event.data) {
          setPerformance(event.data.performance);
          setHealth(event.data.health);
          setUsage(event.data.usage);
          if (event.data.reliability) {
            setReliability(event.data.reliability);
          }
        }
      });
    }
    
    // Keep polling as fallback if auto-refresh is enabled and no DashboardProvider
    let interval: NodeJS.Timeout | null = null;
    if (autoRefresh && !dashboardProvider) {
      interval = setInterval(refreshData, refreshInterval);
    }
    
    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [performanceMonitor, healthChecker, analyticsManager, tracer, reliabilityTracker, dashboardProvider, autoRefresh, refreshInterval]);

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

        {/* Traces Tab - Enhanced with hierarchy and error highlighting */}
        {selectedTab === 'traces' && (() => {
          // Group traces by traceId and build hierarchy
          const tracesByTraceId = new Map<string, TraceSpan[]>();
          activeTraces.forEach(trace => {
            const traces = tracesByTraceId.get(trace.traceId) || [];
            traces.push(trace);
            tracesByTraceId.set(trace.traceId, traces);
          });

          // Build span tree for each trace
          const buildSpanTree = (traces: TraceSpan[]): TraceSpan[] => {
            const spanMap = new Map<string, TraceSpan>();
            const rootSpans: TraceSpan[] = [];

            // First pass: create map
            traces.forEach(span => spanMap.set(span.spanId, span));

            // Second pass: build tree
            traces.forEach(span => {
              if (!span.parentSpanId || !spanMap.has(span.parentSpanId)) {
                rootSpans.push(span);
              }
            });

            return rootSpans.sort((a, b) => a.startTime - b.startTime);
          };

          const renderSpan = (span: TraceSpan, level: number = 0, expandedSpans: Set<string>, toggleExpand: (id: string) => void) => {
            const duration = span.duration || (span.endTime || Date.now()) - span.startTime;
            const isActive = !span.endTime;
            const hasError = span.tags?.success === false || span.tags?.error || span.tags?.errorCode;
            const service = span.tags?.service || span.tags?.agentId || span.tags?.toolId || 'system';
            const childSpans = activeTraces.filter(t => t.parentSpanId === span.spanId);
            const isExpanded = expandedSpans.has(span.spanId);
            const hasChildren = childSpans.length > 0;

            return (
              <div key={span.spanId} className="space-y-1">
                <div 
                  className={`p-3 rounded-lg border transition-all ${
                    hasError
                      ? 'bg-red-50 border-red-200'
                      : isActive 
                        ? 'bg-indigo-50 border-indigo-200' 
                        : 'bg-slate-50 border-slate-200'
                  }`}
                  style={{ marginLeft: `${level * 16}px` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {hasChildren && (
                        <button
                          onClick={() => toggleExpand(span.spanId)}
                          className="flex-shrink-0 p-0.5 hover:bg-slate-200 rounded"
                        >
                          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                      )}
                      {!hasChildren && <div className="w-4" />}
                      <span className={`text-sm font-semibold truncate ${
                        hasError ? 'text-red-700' : 'text-slate-700'
                      }`}>
                        {span.operation}
                      </span>
                      {isActive && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded font-medium flex-shrink-0">
                          ACTIVE
                        </span>
                      )}
                      {hasError && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-medium flex-shrink-0">
                          ERROR
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs font-medium ${
                        duration > 5000 ? 'text-red-600' : duration > 2000 ? 'text-yellow-600' : 'text-slate-500'
                      }`}>
                        {duration.toFixed(0)}ms
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                    <span>Service: {service}</span>
                    {span.traceId && (
                      <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded">
                        Trace: {span.traceId.substring(0, 8)}...
                      </span>
                    )}
                    {span.spanId && (
                      <span className="font-mono text-[10px] text-slate-400">
                        Span: {span.spanId.substring(0, 8)}...
                      </span>
                    )}
                  </div>
                  {hasError && span.tags?.error && (
                    <div className="mt-2 pt-2 border-t border-red-200">
                      <div className="text-[10px] text-red-600 font-medium">
                        Error: {span.tags.error}
                        {span.tags.errorCode && ` (${span.tags.errorCode})`}
                      </div>
                    </div>
                  )}
                  {isExpanded && span.tags && Object.keys(span.tags).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200">
                      <div className="text-[10px] text-slate-400 space-y-1">
                        <div className="font-semibold text-slate-500 mb-1">Tags:</div>
                        {Object.entries(span.tags).map(([k, v]) => (
                          <div key={k} className="flex gap-2">
                            <span className="font-medium">{k}:</span>
                            <span className="font-mono">{typeof v === 'object' ? JSON.stringify(v).substring(0, 50) : String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {isExpanded && span.logs && span.logs.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-200">
                      <div className="text-[10px] text-slate-400 space-y-1">
                        <div className="font-semibold text-slate-500 mb-1">Logs ({span.logs.length}):</div>
                        {span.logs.slice(0, 5).map((log, idx) => (
                          <div key={idx} className="font-mono text-[9px]">
                            [{new Date(log.timestamp).toLocaleTimeString()}] {log.message}
                          </div>
                        ))}
                        {span.logs.length > 5 && <div className="text-slate-400">... {span.logs.length - 5} more</div>}
                      </div>
                    </div>
                  )}
                </div>
                {isExpanded && hasChildren && (
                  <div className="space-y-1">
                    {childSpans
                      .sort((a, b) => a.startTime - b.startTime)
                      .map(child => renderSpan(child, level + 1, expandedSpans, toggleExpand))}
                  </div>
                )}
              </div>
            );
          };

          const [expandedSpans, setExpandedSpans] = useState<Set<string>>(new Set());
          const toggleExpand = (spanId: string) => {
            setExpandedSpans(prev => {
              const next = new Set(prev);
              if (next.has(spanId)) {
                next.delete(spanId);
              } else {
                next.add(spanId);
              }
              return next;
            });
          };

          return (
            <div className="space-y-4">
              {activeTraces.length === 0 ? (
                <div className="text-center text-slate-400 py-8 text-sm">
                  <Layers size={24} className="mx-auto mb-2 opacity-50" />
                  <div>No active traces</div>
                  <div className="text-xs mt-1">Traces will appear here as requests are processed</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {Array.from(tracesByTraceId.entries()).map(([traceId, traces]) => {
                    const rootSpans = buildSpanTree(traces);
                    const totalDuration = traces.reduce((max, t) => {
                      const end = t.endTime || Date.now();
                      return Math.max(max, end - t.startTime);
                    }, 0);
                    const hasErrors = traces.some(t => t.tags?.success === false || t.tags?.error);

                    return (
                      <div key={traceId} className="border border-slate-200 rounded-lg p-3 bg-white">
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-200">
                          <div className="flex items-center gap-2">
                            <Layers size={14} className="text-indigo-600" />
                            <span className="text-xs font-semibold text-slate-700">Trace</span>
                            <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              {traceId.substring(0, 12)}...
                            </span>
                            {hasErrors && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-medium">
                                HAS ERRORS
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500">
                            {traces.length} spans • {totalDuration.toFixed(0)}ms total
                          </div>
                        </div>
                        <div className="space-y-1">
                          {rootSpans.map(span => renderSpan(span, 0, expandedSpans, toggleExpand))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

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


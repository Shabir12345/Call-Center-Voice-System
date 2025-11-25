/**
 * Communication Monitor Dashboard
 * 
 * Real-time dashboard for monitoring agent-to-agent communications.
 * Displays metrics, communication flow graph, conversation history, and anomalies.
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Activity, 
  Download, 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Network,
  BarChart3,
  Filter,
  RefreshCw,
  Zap,
  MessageSquare
} from 'lucide-react';
import { CommunicationMonitor, CommunicationMetrics, AnomalyResult } from '../utils/communicationMonitor';
import { CommunicationEvent } from '../types';

interface CommunicationMonitorProps {
  monitor: CommunicationMonitor;
  onExport?: (data: string) => void;
}

const CommunicationMonitorDashboard: React.FC<CommunicationMonitorProps> = ({ monitor, onExport }) => {
  const [metrics, setMetrics] = useState<CommunicationMetrics | null>(null);
  const [anomalies, setAnomalies] = useState<AnomalyResult[]>([]);
  const [events, setEvents] = useState<CommunicationEvent[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'success' | 'errors'>('all');
  const [timeRange, setTimeRange] = useState<number>(300000); // 5 minutes default
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Refresh data
  const refreshData = () => {
    const currentMetrics = monitor.getMetrics();
    const detectedAnomalies = monitor.detectAnomalies();
    const filters: any = {};
    if (selectedFilter === 'success') filters.success = true;
    if (selectedFilter === 'errors') filters.success = false;
    filters.startTime = Date.now() - timeRange;
    const recentEvents = monitor.logger.getEvents(filters);

    setMetrics(currentMetrics);
    setAnomalies(detectedAnomalies);
    setEvents(recentEvents);
  };

  // Set up auto-refresh
  useEffect(() => {
    refreshData();

    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(() => {
        refreshData();
      }, 2000); // Refresh every 2 seconds
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh, selectedFilter, timeRange]);

  // Note: Real-time event subscription would be handled by CommunicationManager
  // This is a placeholder for future integration

  const handleExport = () => {
    const exportData = monitor.export();
    if (onExport) {
      onExport(exportData);
    } else {
      // Download as file
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `communication-logs-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-600 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  if (!metrics) {
    return (
      <div className="p-8 text-center text-slate-400">
        <Activity className="mx-auto mb-4 animate-spin" size={32} />
        <p>Loading communication metrics...</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 bg-gradient-to-r from-indigo-50 to-white flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Network size={20} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="font-bold text-slate-800 text-sm">Communication Monitor</h2>
            <p className="text-[10px] text-slate-500">Real-time agent communication tracking</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              autoRefresh 
                ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-200' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {autoRefresh ? 'Auto' : 'Manual'}
          </button>
          <button
            onClick={refreshData}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw size={14} className="text-slate-600" />
          </button>
          <button
            onClick={handleExport}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            title="Export Data"
          >
            <Download size={14} className="text-slate-600" />
          </button>
        </div>
      </div>

      {/* Anomalies Alert */}
      {anomalies.length > 0 && (
        <div className="p-3 bg-amber-50 border-b border-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={14} className="text-amber-600" />
            <span className="text-xs font-bold text-amber-800">
              {anomalies.length} Anomaly{anomalies.length > 1 ? 'ies' : ''} Detected
            </span>
          </div>
          <div className="space-y-1">
            {anomalies.slice(0, 3).map((anomaly, idx) => (
              <div key={idx} className="text-[10px] text-amber-700 flex items-center gap-2">
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${getSeverityColor(anomaly.severity)}`}>
                  {anomaly.severity.toUpperCase()}
                </span>
                <span>{anomaly.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Metrics Overview */}
      <div className="p-4 border-b border-slate-200 bg-slate-50">
        <div className="grid grid-cols-4 gap-3">
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase">Total Messages</span>
              <MessageSquare size={12} className="text-indigo-500" />
            </div>
            <div className="text-lg font-bold text-slate-800">{metrics.totalMessages}</div>
            <div className="text-[9px] text-slate-400 mt-1">
              {metrics.successfulMessages} success, {metrics.failedMessages} failed
            </div>
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase">Success Rate</span>
              {metrics.successRate >= 0.9 ? (
                <TrendingUp size={12} className="text-green-500" />
              ) : (
                <TrendingDown size={12} className="text-red-500" />
              )}
            </div>
            <div className="text-lg font-bold text-slate-800">
              {(metrics.successRate * 100).toFixed(1)}%
            </div>
            <div className="text-[9px] text-slate-400 mt-1">
              Error rate: {(metrics.errorRate * 100).toFixed(1)}%
            </div>
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase">Avg Latency</span>
              <Clock size={12} className="text-blue-500" />
            </div>
            <div className="text-lg font-bold text-slate-800">
              {metrics.averageLatency > 0 ? `${metrics.averageLatency.toFixed(0)}ms` : 'N/A'}
            </div>
            <div className="text-[9px] text-slate-400 mt-1">
              Window: {Math.round(timeRange / 1000)}s
            </div>
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] font-bold text-slate-500 uppercase">Active Agents</span>
              <Zap size={12} className="text-purple-500" />
            </div>
            <div className="text-lg font-bold text-slate-800">
              {Object.keys(metrics.messagesByAgent).length}
            </div>
            <div className="text-[9px] text-slate-400 mt-1">
              {metrics.totalMessages} interactions
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="p-3 border-b border-slate-200 bg-white flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Filter size={12} className="text-slate-400" />
          <span className="text-[10px] font-bold text-slate-600">Filter:</span>
        </div>
        <button
          onClick={() => setSelectedFilter('all')}
          className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
            selectedFilter === 'all' 
              ? 'bg-indigo-100 text-indigo-700' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setSelectedFilter('success')}
          className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
            selectedFilter === 'success' 
              ? 'bg-green-100 text-green-700' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Success
        </button>
        <button
          onClick={() => setSelectedFilter('errors')}
          className={`px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
            selectedFilter === 'errors' 
              ? 'bg-red-100 text-red-700' 
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          Errors
        </button>
        <div className="flex-1" />
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(Number(e.target.value))}
          className="text-[10px] border border-slate-200 rounded px-2 py-1 bg-white"
        >
          <option value={60000}>Last minute</option>
          <option value={300000}>Last 5 minutes</option>
          <option value={900000}>Last 15 minutes</option>
          <option value={3600000}>Last hour</option>
        </select>
      </div>

      {/* Events List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50">
        {events.length === 0 ? (
          <div className="text-center text-slate-400 py-8">
            <Activity size={24} className="mx-auto mb-2 opacity-50" />
            <p className="text-xs">No communication events in selected time range</p>
          </div>
        ) : (
          events.map((event) => (
            <div
              key={event.id}
              className={`p-3 rounded-lg border shadow-sm bg-white transition-all ${
                event.success 
                  ? 'border-green-200 bg-green-50/30' 
                  : 'border-red-200 bg-red-50/30'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {event.success ? (
                    <CheckCircle2 size={14} className="text-green-600" />
                  ) : (
                    <XCircle size={14} className="text-red-600" />
                  )}
                  <span className="text-[10px] font-bold text-slate-700 uppercase">
                    {event.type}
                  </span>
                  <span className="text-[9px] text-slate-400">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                {event.duration && (
                  <span className="text-[9px] text-slate-500 font-mono">
                    {event.duration}ms
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-600 mb-1">
                <span className="font-semibold">{event.from}</span>
                <span className="mx-1">→</span>
                <span className="font-semibold">{event.to}</span>
              </div>
              {event.error && (
                <div className="text-[9px] text-red-600 bg-red-50 px-2 py-1 rounded mt-1">
                  <span className="font-bold">Error:</span> {event.error}
                  {event.errorCode && (
                    <span className="ml-2 text-slate-500">({event.errorCode})</span>
                  )}
                </div>
              )}
              {event.metadata && Object.keys(event.metadata).length > 0 && (
                <details className="mt-2">
                  <summary className="text-[9px] text-slate-500 cursor-pointer hover:text-slate-700">
                    View metadata
                  </summary>
                  <pre className="text-[8px] mt-1 p-2 bg-slate-100 rounded overflow-x-auto">
                    {JSON.stringify(event.metadata, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default CommunicationMonitorDashboard;


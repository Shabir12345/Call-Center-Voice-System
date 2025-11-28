/**
 * Analytics Dashboard Component
 * 
 * Real-time dashboard showing metrics, trends, and insights with charts.
 */

import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Activity, TrendingUp, Users, Clock, CheckCircle, AlertTriangle, Download, RefreshCw, Heart, Zap, Layers } from 'lucide-react';
import { DashboardProvider, DashboardData } from '../utils/dashboard';
import { ReliabilityMetrics } from '../utils/reliabilityMetrics';
import { AnomalyDetector, Anomaly } from '../utils/anomalyDetection';

interface AnalyticsDashboardProps {
  dashboardProvider: DashboardProvider;
  onClose?: () => void;
}

const COLORS = ['#4f46e5', '#7c3aed', '#ec4899', '#f59e0b', '#10b981', '#3b82f6'];

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ dashboardProvider, onClose }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [dateRange, setDateRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');

  const fetchData = async () => {
    setLoading(true);
    try {
      const dashboardData = await dashboardProvider.getDashboardData();
      setData(dashboardData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchData, 5000); // Refresh every 5 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, dateRange]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">Loading dashboard...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-slate-400">No data available</div>
      </div>
    );
  }

  // Prepare chart data
  const callVolumeData = [
    { time: '00:00', calls: 12 },
    { time: '04:00', calls: 8 },
    { time: '08:00', calls: 45 },
    { time: '12:00', calls: 67 },
    { time: '16:00', calls: 52 },
    { time: '20:00', calls: 23 },
  ];

  const agentPerformanceData = data.topAgents.map(agent => ({
    name: agent.agentId.substring(0, 15),
    requests: agent.requestCount,
    avgTime: Math.round(agent.averageResponseTime),
    errors: agent.errorRate
  }));

  const intentDistributionData = data.topIntents.map((intent, index) => ({
    name: intent.intent,
    value: intent.count,
    color: COLORS[index % COLORS.length]
  }));

  const handleExport = () => {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-export-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-7xl max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 rounded-lg">
            <Activity size={24} className="text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Analytics Dashboard</h2>
            <p className="text-sm text-slate-500">Real-time call center metrics</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`p-2 rounded-lg transition-colors ${
              autoRefresh ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'
            }`}
            title={autoRefresh ? 'Auto-refresh enabled' : 'Auto-refresh disabled'}
          >
            <RefreshCw size={18} className={autoRefresh ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleExport}
            className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            title="Export data"
          >
            <Download size={18} className="text-slate-600" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-lg border border-indigo-200">
          <div className="flex items-center justify-between mb-2">
            <Users size={20} className="text-indigo-600" />
            <TrendingUp size={16} className="text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-900">{data.sessions.active}</div>
          <div className="text-xs text-indigo-700">Active Calls</div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <Activity size={20} className="text-purple-600" />
            <TrendingUp size={16} className="text-purple-500" />
          </div>
          <div className="text-2xl font-bold text-purple-900">{data.sessions.total}</div>
          <div className="text-xs text-purple-700">Total Sessions</div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 p-4 rounded-lg border border-emerald-200">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle size={20} className="text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700">
              {data.usage.successRate.toFixed(1)}%
            </span>
          </div>
          <div className="text-2xl font-bold text-emerald-900">
            {Math.round(data.usage.averageSessionDuration / 1000)}s
          </div>
          <div className="text-xs text-emerald-700">Avg Duration</div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-lg border border-amber-200">
          <div className="flex items-center justify-between mb-2">
            <AlertTriangle size={20} className="text-amber-600" />
            <span className="text-xs font-semibold text-amber-700">
              {data.alerts.critical}
            </span>
          </div>
          <div className="text-2xl font-bold text-amber-900">
            {data.usage.errorRate.toFixed(1)}%
          </div>
          <div className="text-xs text-amber-700">Error Rate</div>
        </div>

        {/* Health Status */}
        <div className={`bg-gradient-to-br p-4 rounded-lg border ${
          data.health.overall === 'healthy' 
            ? 'from-green-50 to-green-100 border-green-200'
            : data.health.overall === 'degraded'
            ? 'from-yellow-50 to-yellow-100 border-yellow-200'
            : 'from-red-50 to-red-100 border-red-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <Heart size={20} className={
              data.health.overall === 'healthy' ? 'text-green-600' :
              data.health.overall === 'degraded' ? 'text-yellow-600' :
              'text-red-600'
            } />
            <span className={`text-xs font-semibold ${
              data.health.overall === 'healthy' ? 'text-green-700' :
              data.health.overall === 'degraded' ? 'text-yellow-700' :
              'text-red-700'
            }`}>
              {data.health.summary.healthy + data.health.summary.degraded + data.health.summary.unhealthy}
            </span>
          </div>
          <div className={`text-2xl font-bold ${
            data.health.overall === 'healthy' ? 'text-green-900' :
            data.health.overall === 'degraded' ? 'text-yellow-900' :
            'text-red-900'
          }`}>
            {data.health.overall.toUpperCase()}
          </div>
          <div className={`text-xs ${
            data.health.overall === 'healthy' ? 'text-green-700' :
            data.health.overall === 'degraded' ? 'text-yellow-700' :
            'text-red-700'
          }`}>System Health</div>
        </div>

        {/* Reliability Score */}
        {data.reliability && (
          <div className={`bg-gradient-to-br p-4 rounded-lg border ${
            data.reliability.reliabilityScore >= 90
              ? 'from-green-50 to-green-100 border-green-200'
              : data.reliability.reliabilityScore >= 70
              ? 'from-yellow-50 to-yellow-100 border-yellow-200'
              : 'from-red-50 to-red-100 border-red-200'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <Zap size={20} className={
                data.reliability.reliabilityScore >= 90 ? 'text-green-600' :
                data.reliability.reliabilityScore >= 70 ? 'text-yellow-600' :
                'text-red-600'
              } />
              <span className={`text-xs font-semibold capitalize ${
                data.reliability.reliabilityScore >= 90 ? 'text-green-700' :
                data.reliability.reliabilityScore >= 70 ? 'text-yellow-700' :
                'text-red-700'
              }`}>
                {data.reliability.trend}
              </span>
            </div>
            <div className={`text-2xl font-bold ${
              data.reliability.reliabilityScore >= 90 ? 'text-green-900' :
              data.reliability.reliabilityScore >= 70 ? 'text-yellow-900' :
              'text-red-900'
            }`}>
              {data.reliability.reliabilityScore}/100
            </div>
            <div className={`text-xs ${
              data.reliability.reliabilityScore >= 90 ? 'text-green-700' :
              data.reliability.reliabilityScore >= 70 ? 'text-yellow-700' :
              'text-red-700'
            }`}>Reliability</div>
          </div>
        )}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Call Volume Trend */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Call Volume Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={callVolumeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="time" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip />
              <Line type="monotone" dataKey="calls" stroke="#4f46e5" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Agent Performance */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Agent Performance</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={agentPerformanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip />
              <Legend />
              <Bar dataKey="requests" fill="#4f46e5" name="Requests" />
              <Bar dataKey="avgTime" fill="#7c3aed" name="Avg Time (ms)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Intent Distribution */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Intent Distribution</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={intentDistributionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={60}
                fill="#8884d8"
                dataKey="value"
              >
                {intentDistributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Performance Metrics */}
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">Performance Metrics</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Avg Response Time</span>
              <span className="text-sm font-semibold text-slate-800">
                {Math.round(data.performance.responseTime.average)}ms
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Throughput</span>
              <span className="text-sm font-semibold text-slate-800">
                {data.performance.throughput.requestsPerSecond.toFixed(2)} req/s
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Success Rate</span>
              <span className="text-sm font-semibold text-emerald-600">
                {data.usage.successRate.toFixed(1)}%
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-600">Error Rate</span>
              <span className="text-sm font-semibold text-rose-600">
                {data.usage.errorRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Reliability Metrics Section */}
      {data.reliability && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Zap size={16} className="text-indigo-600" />
              Reliability Metrics
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Uptime</span>
                <span className="text-sm font-semibold text-green-600">
                  {data.reliability.uptimePercentage.toFixed(2)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">MTTR</span>
                <span className="text-sm font-semibold text-slate-800">
                  {(data.reliability.mttr / 1000).toFixed(1)}s
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">MTBF</span>
                <span className="text-sm font-semibold text-slate-800">
                  {(data.reliability.mtbf / 1000).toFixed(0)}s
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-600">Error Rate</span>
                <span className="text-sm font-semibold text-red-600">
                  {data.reliability.errorRate.toFixed(2)}/hr
                </span>
              </div>
              <div className="pt-3 border-t border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-500">Incidents</span>
                  <span className="text-xs text-slate-700">
                    {data.reliability.totalIncidents} total, {data.reliability.resolvedIncidents} resolved, {data.reliability.criticalIncidents} critical
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Heart size={16} className="text-indigo-600" />
              Component Health
            </h3>
            <div className="space-y-2">
              {data.health.components && data.health.components.length > 0 ? (
                data.health.components.map((component, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-white rounded border border-slate-200">
                    <span className="text-sm font-medium text-slate-700">{component.name}</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${
                      component.status === 'healthy' 
                        ? 'text-green-600 bg-green-50 border border-green-200'
                        : component.status === 'degraded'
                        ? 'text-yellow-600 bg-yellow-50 border border-yellow-200'
                        : 'text-red-600 bg-red-50 border border-red-200'
                    }`}>
                      {component.status.toUpperCase()}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-400 text-center py-4">No component data available</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Top Agents Table */}
      <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Top Agents</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-300">
                <th className="text-left py-2 px-3 text-slate-600 font-semibold">Agent ID</th>
                <th className="text-right py-2 px-3 text-slate-600 font-semibold">Requests</th>
                <th className="text-right py-2 px-3 text-slate-600 font-semibold">Avg Time (ms)</th>
                <th className="text-right py-2 px-3 text-slate-600 font-semibold">Error Rate</th>
              </tr>
            </thead>
            <tbody>
              {data.topAgents.map((agent, index) => (
                <tr key={agent.agentId} className="border-b border-slate-200 hover:bg-white">
                  <td className="py-2 px-3 text-slate-700 font-mono text-xs">{agent.agentId}</td>
                  <td className="py-2 px-3 text-right text-slate-700">{agent.requestCount}</td>
                  <td className="py-2 px-3 text-right text-slate-700">{Math.round(agent.averageResponseTime)}</td>
                  <td className="py-2 px-3 text-right">
                    <span className={`font-semibold ${
                      agent.errorRate > 10 ? 'text-rose-600' : 
                      agent.errorRate > 5 ? 'text-amber-600' : 
                      'text-emerald-600'
                    }`}>
                      {agent.errorRate.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Anomalies Section */}
      {data.anomalies && data.anomalies.length > 0 && (
        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 mt-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-600" />
            Recent Anomalies ({data.anomalies.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {data.anomalies.slice(0, 10).map((anomaly, idx) => (
              <div 
                key={anomaly.id} 
                className={`p-3 rounded-lg border ${
                  anomaly.severity === 'critical' 
                    ? 'bg-red-50 border-red-200'
                    : anomaly.severity === 'high'
                    ? 'bg-orange-50 border-orange-200'
                    : anomaly.severity === 'medium'
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        anomaly.severity === 'critical' 
                          ? 'bg-red-100 text-red-700'
                          : anomaly.severity === 'high'
                          ? 'bg-orange-100 text-orange-700'
                          : anomaly.severity === 'medium'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {anomaly.severity.toUpperCase()}
                      </span>
                      <span className="text-xs font-semibold text-slate-700">{anomaly.type.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="text-xs text-slate-600">{anomaly.description}</p>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {new Date(anomaly.detectedAt).toLocaleTimeString()}
                  </span>
                </div>
                {anomaly.recommendations && anomaly.recommendations.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-200">
                    <div className="text-[10px] font-semibold text-slate-500 mb-1">Recommendations:</div>
                    <ul className="list-disc list-inside text-[10px] text-slate-600 space-y-0.5">
                      {anomaly.recommendations.slice(0, 2).map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AnalyticsDashboard;


/**
 * Routing Debug Panel
 * 
 * Debug view for inspecting routing decisions, connection scores, and intent extraction.
 * Used in TestPanel for testing and iterating on connection context cards.
 */

import React, { useState, useEffect } from 'react';
import { X, Eye, TrendingUp, Target, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { RoutingDecision, ConnectionScore, CallerIntent, ConversationState } from '../types';
import { getRoutingLogger, RoutingLogEntry } from '../utils/routingLogger';

interface RoutingDebugPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentNodeId?: string;
  callerUtterance?: string;
  conversationState?: ConversationState;
  decision?: RoutingDecision;
  candidates?: ConnectionScore[];
}

export const RoutingDebugPanel: React.FC<RoutingDebugPanelProps> = ({
  isOpen,
  onClose,
  currentNodeId,
  callerUtterance,
  conversationState,
  decision,
  candidates,
}) => {
  const [logs, setLogs] = useState<RoutingLogEntry[]>([]);
  const [selectedLog, setSelectedLog] = useState<RoutingLogEntry | null>(null);
  const logger = getRoutingLogger();

  useEffect(() => {
    if (isOpen) {
      // Load recent logs
      const recentLogs = logger.getLogs().slice(0, 50);
      setLogs(recentLogs);
    }
  }, [isOpen, logger]);

  if (!isOpen) return null;

  const displayDecision = decision || selectedLog?.decision;
  const displayCandidates = candidates || selectedLog?.candidates || [];
  const displayIntent = conversationState?.currentIntent || selectedLog?.intent;
  const displayUtterance = callerUtterance || selectedLog?.callerUtterance;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Routing Debug Panel</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Current Decision (if provided) */}
          {displayDecision && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Target className="w-5 h-5 text-blue-600" />
                Current Routing Decision
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Chosen Connection:</span>{' '}
                  <code className="bg-white px-2 py-1 rounded">{displayDecision.chosenConnectionId}</code>
                </div>
                <div>
                  <span className="font-medium">Score:</span>{' '}
                  <span className={`font-bold ${displayDecision.score >= 0.7 ? 'text-green-600' : displayDecision.score >= 0.5 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {(displayDecision.score * 100).toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="font-medium">Reason:</span>{' '}
                  <span className="text-gray-700">{displayDecision.reason}</span>
                </div>
                {displayDecision.usedFallback && (
                  <div className="flex items-center gap-2 text-orange-600">
                    <AlertCircle className="w-4 h-4" />
                    <span>Used fallback connection</span>
                  </div>
                )}
                {displayDecision.requiredConfirmation && (
                  <div className="flex items-center gap-2 text-purple-600">
                    <Info className="w-4 h-4" />
                    <span>Requires confirmation</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Intent Information */}
          {displayIntent && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-600" />
                Extracted Intent
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-medium">Label:</span>{' '}
                  <code className="bg-white px-2 py-1 rounded">{displayIntent.intentLabel}</code>
                </div>
                <div>
                  <span className="font-medium">Confidence:</span>{' '}
                  <span className={`font-bold ${displayIntent.confidence >= 0.7 ? 'text-green-600' : displayIntent.confidence >= 0.5 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {(displayIntent.confidence * 100).toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="font-medium">Urgency:</span>{' '}
                  <span className="capitalize">{displayIntent.urgency}</span>
                </div>
                {Object.keys(displayIntent.entities).length > 0 && (
                  <div>
                    <span className="font-medium">Entities:</span>
                    <pre className="bg-white p-2 rounded mt-1 text-xs overflow-x-auto">
                      {JSON.stringify(displayIntent.entities, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Caller Utterance */}
          {displayUtterance && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold mb-2 text-sm">Caller Utterance</h3>
              <p className="text-sm text-gray-700">"{displayUtterance}"</p>
            </div>
          )}

          {/* Candidate Connections */}
          {displayCandidates.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Candidate Connections ({displayCandidates.length})</h3>
              <div className="space-y-2">
                {displayCandidates.map((candidate, index) => (
                  <div
                    key={candidate.connectionId}
                    className={`border rounded-lg p-3 ${
                      candidate.connectionId === displayDecision?.chosenConnectionId
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {candidate.connectionId === displayDecision?.chosenConnectionId && (
                          <CheckCircle2 className="w-4 h-4 text-blue-600" />
                        )}
                        <span className="font-medium text-sm">#{index + 1}</span>
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {candidate.connectionId.substring(0, 20)}...
                        </code>
                      </div>
                      <div className={`font-bold text-sm ${
                        candidate.score >= 0.7 ? 'text-green-600' :
                        candidate.score >= 0.5 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {(candidate.score * 100).toFixed(1)}%
                      </div>
                    </div>
                    <p className="text-xs text-gray-600">{candidate.reason}</p>
                    {candidate.metadata && Object.keys(candidate.metadata).length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-gray-500 cursor-pointer">Metadata</summary>
                        <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-x-auto">
                          {JSON.stringify(candidate.metadata, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Log History */}
          {logs.length > 0 && (
            <div>
              <h3 className="font-semibold mb-3">Recent Routing Decisions</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {logs.map((log) => (
                  <button
                    key={log.id}
                    onClick={() => setSelectedLog(log)}
                    className={`w-full text-left border rounded-lg p-3 hover:bg-gray-50 transition-colors ${
                      selectedLog?.id === log.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      <span className={`text-xs font-bold ${
                        log.decision.score >= 0.7 ? 'text-green-600' :
                        log.decision.score >= 0.5 ? 'text-yellow-600' :
                        'text-red-600'
                      }`}>
                        {(log.decision.score * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 truncate">"{log.callerUtterance}"</p>
                    {log.intent && (
                      <p className="text-xs text-gray-500 mt-1">
                        Intent: {log.intent.intentLabel} ({(log.intent.confidence * 100).toFixed(0)}%)
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Conversation State */}
          {conversationState && (
            <details className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <summary className="font-semibold cursor-pointer">Conversation State</summary>
              <pre className="text-xs mt-2 overflow-x-auto">
                {JSON.stringify(conversationState, null, 2)}
              </pre>
            </details>
          )}
        </div>
      </div>
    </div>
  );
};


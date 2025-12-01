/**
 * Session Memory Panel Component
 * 
 * Displays the temporary session memory for the current call.
 * Shows what data is stored, when it was stored, and allows inspection
 * to improve memory storage logic.
 */

import React, { useState, useEffect } from 'react';
import { Brain, Database, Clock, ChevronDown, ChevronRight, Copy, Check, Trash2, RefreshCw, Info } from 'lucide-react';
import { StateManager, SessionMemory } from '../utils/stateManager';

interface SessionMemoryPanelProps {
  stateManager?: StateManager;
  sessionId?: string; // Optional - will try to find active session if not provided
  autoRefresh?: boolean;
  refreshInterval?: number;
}

const SessionMemoryPanel: React.FC<SessionMemoryPanelProps> = ({
  stateManager,
  sessionId,
  autoRefresh = true,
  refreshInterval = 2000
}) => {
  const [sessionMemory, setSessionMemory] = useState<SessionMemory>({});
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>(sessionId);

  const refreshMemory = async () => {
    if (!stateManager) return;

    try {
      let currentSessionId = sessionId;
      
      // If no sessionId provided, try to find the most recent active session
      if (!currentSessionId) {
        const activeSessions = stateManager.getActiveSessions();
        if (activeSessions.length > 0) {
          // Get the most recently updated session
          currentSessionId = activeSessions.sort((a, b) => b.updated_at - a.updated_at)[0].id;
        } else {
          // No active sessions
          setSessionMemory({});
          setActiveSessionId(undefined);
          return;
        }
      }

      // Update the active session ID state
      setActiveSessionId(currentSessionId);

      const session = await stateManager.getSession(currentSessionId);
      if (session) {
        setSessionMemory(session.sessionMemory || {});
        setLastUpdated(new Date());
      } else {
        setSessionMemory({});
      }
    } catch (error) {
      console.error('Error refreshing session memory:', error);
    }
  };

  useEffect(() => {
    refreshMemory();

    if (autoRefresh) {
      const interval = setInterval(refreshMemory, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [stateManager, sessionId, autoRefresh, refreshInterval]);

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const copyToClipboard = async (key: string, value: any) => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const clearMemory = async (key?: string) => {
    if (!stateManager || !activeSessionId) return;
    
    try {
      await stateManager.clearSessionMemory(activeSessionId, key);
      await refreshMemory();
    } catch (error) {
      console.error('Error clearing memory:', error);
    }
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const getValuePreview = (value: any): string => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return `[Array with ${value.length} items]`;
      }
      const keys = Object.keys(value);
      if (keys.length === 0) return '{}';
      return `{${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '...' : ''}}`;
    }
    const str = String(value);
    return str.length > 50 ? str.substring(0, 50) + '...' : str;
  };

  const memoryKeys = Object.keys(sessionMemory);
  const hasMemory = memoryKeys.length > 0;

  return (
    <div className="h-full flex flex-col bg-white border-b border-slate-200">
      {/* Header */}
      <div className="p-3 border-b border-slate-200 bg-gradient-to-r from-purple-50 to-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-purple-100 rounded-md text-purple-600">
            <Brain size={16} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-xs">Session Memory</h3>
            <div className="flex items-center gap-1 text-[9px] text-slate-500">
              <Clock size={10} />
              <span>Updated {lastUpdated.toLocaleTimeString()}</span>
              {activeSessionId && (
                <>
                  <span>•</span>
                  <span className="font-mono" title={activeSessionId}>
                    {activeSessionId.length > 20 ? activeSessionId.substring(0, 20) + '...' : activeSessionId}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={refreshMemory}
            className="p-1.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
            title="Refresh Memory"
          >
            <RefreshCw size={14} />
          </button>
          {hasMemory && (
            <button
              onClick={() => clearMemory()}
              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Clear All Memory"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Memory Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {!hasMemory ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="p-3 bg-slate-100 rounded-full mb-3">
              <Database size={24} className="text-slate-400" />
            </div>
            <p className="text-sm text-slate-500 font-medium mb-1">No Memory Stored</p>
            <p className="text-xs text-slate-400 max-w-[200px]">
              Memory will appear here as the conversation progresses and important data is stored.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {memoryKeys.map((key) => {
              const value = sessionMemory[key];
              const isExpanded = expandedKeys.has(key);
              const preview = getValuePreview(value);
              const hasRetrievedAt = value && typeof value === 'object' && 'retrievedAt' in value;

              return (
                <div
                  key={key}
                  className="border border-slate-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow"
                >
                  {/* Key Header */}
                  <div
                    className="p-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                    onClick={() => toggleExpand(key)}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isExpanded ? (
                        <ChevronDown size={14} className="text-slate-400 flex-shrink-0" />
                      ) : (
                        <ChevronRight size={14} className="text-slate-400 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-slate-800">{key}</span>
                          {hasRetrievedAt && (
                            <span className="text-[9px] text-slate-400 font-mono">
                              {formatTimestamp((value as any).retrievedAt)}
                            </span>
                          )}
                        </div>
                        {!isExpanded && (
                          <div className="text-[10px] text-slate-500 mt-0.5 truncate font-mono">
                            {preview}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(key, value);
                        }}
                        className="p-1 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors"
                        title="Copy to Clipboard"
                      >
                        {copiedKey === key ? (
                          <Check size={12} className="text-green-600" />
                        ) : (
                          <Copy size={12} />
                        )}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          clearMemory(key);
                        }}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                        title="Clear This Key"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Value */}
                  {isExpanded && (
                    <div className="border-t border-slate-100 p-3 bg-slate-50">
                      <div className="mb-2 flex items-center gap-1 text-[9px] text-slate-500 uppercase tracking-wide">
                        <Info size={10} />
                        <span>Full Value</span>
                      </div>
                      <pre className="text-[10px] font-mono text-slate-700 bg-white border border-slate-200 rounded p-2 overflow-x-auto max-h-64 overflow-y-auto">
                        {formatValue(value)}
                      </pre>
                      {hasRetrievedAt && (
                        <div className="mt-2 text-[9px] text-slate-400">
                          Stored at: {formatTimestamp((value as any).retrievedAt)}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer Info */}
      {hasMemory && (
        <div className="p-2 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center gap-1.5 text-[9px] text-slate-500">
            <Info size={10} />
            <span>
              {memoryKeys.length} {memoryKeys.length === 1 ? 'item' : 'items'} stored in memory
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionMemoryPanel;


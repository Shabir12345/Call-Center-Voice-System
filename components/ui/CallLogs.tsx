/**
 * CallLogs Component
 * 
 * Displays debug logs with expandable details for the call center system.
 * Extracted from TestPanel to improve code organization and reusability.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight, FileJson, Zap, CheckCircle2, AlertTriangle, Bot, Network } from 'lucide-react';

export interface LogEntry {
  id: string;
  role: 'user' | 'agent' | 'system' | 'debug';
  text: string;
  timestamp: Date;
  details?: any;
}

interface CallLogsProps {
  logs: LogEntry[];
  maxLogs?: number;
}

const DebugLogItem: React.FC<{ log: LogEntry }> = ({ log }) => {
  const [expanded, setExpanded] = useState(false);
  
  // Determine icon and color based on log content
  const getLogIcon = () => {
    const text = log.text.toLowerCase();
    if (text.includes('mock data') || text.includes('mock integration')) {
      return { icon: FileJson, color: 'text-purple-500', bg: 'bg-purple-50 border-purple-200' };
    }
    if (text.includes('tool result') || text.includes('tool execution')) {
      return { icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-50 border-yellow-200' };
    }
    if (text.includes('normalized') || text.includes('normalization')) {
      return { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50 border-green-200' };
    }
    if (text.includes('error') || text.includes('failed')) {
      return { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50 border-red-200' };
    }
    if (text.includes('sub-agent') || text.includes('department')) {
      return { icon: Bot, color: 'text-cyan-500', bg: 'bg-cyan-50 border-cyan-200' };
    }
    return { icon: Network, color: 'text-slate-500', bg: 'bg-slate-100 border-slate-200' };
  };
  
  const { icon: Icon, color, bg } = getLogIcon();
  
  // Extract key information from details for preview
  const getPreviewInfo = () => {
    if (!log.details) return null;
    const details = log.details as any;
    if (details.dataStructure) return `Structure: ${details.dataStructure}`;
    if (details.summary) return `Summary: ${details.summary.substring(0, 50)}...`;
    if (details.dataKeys && Array.isArray(details.dataKeys)) return `Fields: ${details.dataKeys.join(', ')}`;
    if (details.success !== undefined) return `Success: ${details.success}`;
    if (details.hasData !== undefined) return `Has Data: ${details.hasData}`;
    return null;
  };
  
  const previewInfo = getPreviewInfo();
  
  return (
    <div className="flex flex-col my-1 animate-fadeIn max-w-[90%] self-center w-full">
      <div 
        className={`flex items-center gap-2 px-3 py-1.5 ${bg} border rounded-md cursor-pointer hover:opacity-80 transition-all`}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown size={12} className={color}/> : <ChevronRight size={12} className={color}/>}
        <Icon size={12} className={color} />
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide block truncate">{log.text}</span>
          {previewInfo && !expanded && (
            <span className="text-[9px] text-slate-500 italic truncate block mt-0.5">{previewInfo}</span>
          )}
        </div>
        <span className="text-[9px] text-slate-400 font-mono">DEBUG</span>
      </div>
      {expanded && log.details && (
        <div className="mt-1 ml-4 p-3 bg-slate-800 rounded-md text-slate-300 font-mono text-[10px] overflow-x-auto border border-slate-700 shadow-inner">
          <div className="mb-2 text-slate-400 text-[9px] uppercase tracking-wide">Details</div>
          <pre className="whitespace-pre-wrap break-words">{JSON.stringify(log.details, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export const CallLogs: React.FC<CallLogsProps> = ({ logs, maxLogs = 100 }) => {
  // Limit the number of logs displayed to prevent performance issues
  const displayedLogs = logs.slice(-maxLogs);
  
  return (
    <div className="flex flex-col gap-1 overflow-y-auto p-2">
      {displayedLogs.length === 0 ? (
        <div className="text-center text-slate-400 text-sm py-8">
          No debug logs yet. Start a call to see activity.
        </div>
      ) : (
        displayedLogs.map((log) => (
          <DebugLogItem key={log.id} log={log} />
        ))
      )}
    </div>
  );
};


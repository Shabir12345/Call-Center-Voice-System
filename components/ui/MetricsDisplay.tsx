/**
 * MetricsDisplay Component
 * 
 * Extracted from TestPanel to improve code organization and reusability.
 * Displays session metrics including duration, resolutions, and architecture stats.
 */

import React from 'react';
import { Clock, CheckCircle2, Network, Download } from 'lucide-react';

export interface MetricsDisplayProps {
  sessionDuration: number;
  metrics: {
    totalInteractions: number;
    successfulResolutions: number;
    isSessionResolved: boolean;
  };
  departmentCount: number;
  toolCount: number;
  onDownloadLog?: () => void;
}

/**
 * MetricsDisplay Component
 * 
 * Displays session metrics in a compact stats bar format.
 */
export const MetricsDisplay: React.FC<MetricsDisplayProps> = ({
  sessionDuration,
  metrics,
  departmentCount,
  toolCount,
  onDownloadLog
}) => {
  // Format session duration as MM:SS
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white border-b border-slate-100 py-2 px-4 flex items-center justify-between text-[10px] font-medium text-slate-500">
      <div className="flex items-center gap-4">
        {/* Duration */}
        <div className="flex items-center gap-1.5" title="Duration">
          <Clock size={12} className="text-indigo-500"/>
          <span className="font-mono text-slate-700">{formatDuration(sessionDuration)}</span>
        </div>
        
        {/* Resolution Status */}
        <div className="flex items-center gap-1.5" title="Resolution">
          <CheckCircle2 size={12} className={metrics.isSessionResolved ? "text-amber-500" : "text-slate-300"}/>
          <span className={metrics.isSessionResolved ? "text-amber-600 font-bold" : "text-slate-400"}>
            {metrics.successfulResolutions} Resolved
          </span>
        </div>
        
        {/* Architecture Stats */}
        <div className="flex items-center gap-1.5" title="Agents">
          <Network size={12} className="text-slate-400" />
          <span className="text-[10px] text-slate-500">
            {departmentCount} Depts / {toolCount} Tools
          </span>
        </div>
      </div>
      
      {/* Download Log Button */}
      {onDownloadLog && (
        <button 
          onClick={onDownloadLog} 
          className="hover:text-indigo-600 transition-colors" 
          title="Download Log"
          aria-label="Download log"
        >
          <Download size={14} />
        </button>
      )}
    </div>
  );
};


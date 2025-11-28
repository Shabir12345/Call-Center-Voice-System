/**
 * Knowledge Base Node Component
 * 
 * Node for managing knowledge base articles in the workflow editor.
 */

import React from 'react';
import { Database, FileText } from 'lucide-react';
import { Handle, Position, NodeProps } from 'reactflow';
import { KnowledgeBaseNodeData, NodeType } from '../../types';

const KnowledgeBaseNode: React.FC<NodeProps<KnowledgeBaseNodeData>> = ({ data, selected }) => {
  const isActive = !!data.active;
  const isError = !!data.error;
  
  return (
    <div className={`px-4 py-3 shadow-lg rounded-lg border-2 min-w-[200px] bg-white transition-all duration-300 ${
      isError ? 'border-red-400 ring-2 ring-red-100' : 
      isActive ? 'border-amber-400 ring-4 ring-amber-200 shadow-glow-amber animate-pulse-glow' :
      selected ? 'border-indigo-500' : 'border-slate-300'
    }`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 bg-purple-100 rounded text-purple-600">
          <Database size={16} />
        </div>
        <div className="flex-1">
          <div className="font-bold text-xs text-slate-800">{data.label || 'Knowledge Base'}</div>
          {data.error && (
            <div className="text-[10px] text-rose-600 mt-0.5">{data.error}</div>
          )}
        </div>
      </div>

      <div className="text-[10px] text-slate-500 space-y-1">
        <div className="flex items-center gap-1">
          <FileText size={12} />
          <span>{data.articles?.length || 0} articles</span>
        </div>
        <div className="text-[9px] text-slate-400">
          Search: {data.searchType || 'keyword'}
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
};

export default KnowledgeBaseNode;


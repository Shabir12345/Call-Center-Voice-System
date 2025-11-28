/**
 * Customer Profile Node Component
 * 
 * Node for customer profile management in the workflow editor.
 */

import React from 'react';
import { User, Building } from 'lucide-react';
import { Handle, Position, NodeProps } from 'reactflow';
import { CustomerProfileNodeData, NodeType } from '../../types';

const CustomerProfileNode: React.FC<NodeProps<CustomerProfileNodeData>> = ({ data, selected }) => {
  const isActive = !!data.active;
  const isError = !!data.error;
  
  return (
    <div className={`px-4 py-3 shadow-lg rounded-lg border-2 min-w-[200px] bg-white transition-all duration-300 ${
      isError ? 'border-red-400 ring-2 ring-red-100' : 
      isActive ? 'border-cyan-400 ring-4 ring-cyan-200 shadow-glow-cyan animate-pulse-glow' :
      selected ? 'border-indigo-500' : 'border-slate-300'
    }`}>
      <Handle type="target" position={Position.Top} className="w-3 h-3" />
      
      <div className="flex items-center gap-2 mb-2">
        <div className="p-1.5 bg-cyan-100 rounded text-cyan-600">
          <User size={16} />
        </div>
        <div className="flex-1">
          <div className="font-bold text-xs text-slate-800">{data.label || 'Customer Profile'}</div>
          {data.error && (
            <div className="text-[10px] text-rose-600 mt-0.5">{data.error}</div>
          )}
        </div>
      </div>

      <div className="text-[10px] text-slate-500 space-y-1">
        {data.crmConfig && (
          <div className="flex items-center gap-1">
            <Building size={12} />
            <span className="capitalize">{data.crmConfig.provider}</span>
          </div>
        )}
        {data.autoDetect && (
          <div className="text-[9px] text-slate-400">Auto-detect enabled</div>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="w-3 h-3" />
    </div>
  );
};

export default CustomerProfileNode;


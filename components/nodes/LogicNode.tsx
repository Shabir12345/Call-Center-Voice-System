import React, { useState } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { LogicNodeData } from '../../types';
import { Split, ChevronDown, ChevronRight, AlertCircle, X, Variable } from 'lucide-react';

const LogicNode: React.FC<NodeProps<LogicNodeData>> = ({ data, id }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  const handleChange = (field: keyof LogicNodeData, value: string) => {
    if (data.onLogicChange) {
      data.onLogicChange(id, field, value);
    }
  };

  const isActive = !!data.active;
  const isError = !!data.error;

  return (
    <div className={`w-64 rounded-xl bg-white border shadow-node transition-all duration-300 hover:shadow-node-hover group ${isError ? 'border-red-400 ring-2 ring-red-100' : isActive ? 'border-rose-400 ring-4 ring-rose-200 shadow-glow-rose animate-pulse-glow' : 'border-slate-300'}`}>
      
      {/* Header */}
      <div 
        className={`p-2.5 border-b flex items-center justify-between ${isCollapsed ? 'rounded-xl border-b-0' : 'rounded-t-xl'} ${isActive ? 'bg-gradient-to-r from-rose-100 to-rose-50' : 'bg-slate-50'} border-slate-200 cursor-pointer`}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2">
          <div className={`p-1 rounded-md ${isActive ? 'bg-rose-500 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}>
            <Split size={14} />
          </div>
          <span className="font-bold text-slate-700 text-xs">Condition</span>
        </div>
        <div className="flex items-center gap-1">
             <button onClick={() => data.onDelete && data.onDelete(id)} className="text-slate-400 hover:text-red-500 p-1"><X size={12} /></button>
             <button className="text-slate-400 p-1">{isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}</button>
        </div>
      </div>

      <Handle type="target" position={Position.Top} className="!bg-slate-400 !w-3 !h-3 !border-2 !border-white" />

      {!isCollapsed && (
        <div className="p-3 space-y-3 animate-fadeIn">
            {/* Logic Builder */}
            <div className="space-y-2">
                <div className="relative">
                    <Variable size={10} className="absolute left-2.5 top-2.5 text-slate-400" />
                    <input 
                        className="nodrag w-full text-xs font-mono font-medium border border-slate-200 rounded pl-7 pr-2 py-1.5 focus:border-rose-400 outline-none"
                        placeholder="Variable Name"
                        value={data.variableName || ''}
                        onChange={(e) => handleChange('variableName', e.target.value)}
                    />
                </div>
                
                <select 
                    className="nodrag w-full text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 focus:border-rose-400 outline-none"
                    value={data.operator || 'equals'}
                    onChange={(e) => handleChange('operator', e.target.value as any)}
                >
                    <option value="equals">Equals (==)</option>
                    <option value="contains">Contains</option>
                    <option value="greater_than">Greater Than (&gt;)</option>
                    <option value="less_than">Less Than (&lt;)</option>
                    <option value="exists">Exists</option>
                </select>

                {data.operator !== 'exists' && (
                    <input 
                        className="nodrag w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:border-rose-400 outline-none"
                        placeholder="Comparison Value"
                        value={data.value || ''}
                        onChange={(e) => handleChange('value', e.target.value)}
                    />
                )}
            </div>
        </div>
      )}

      {/* Outputs */}
      <div className="flex border-t border-slate-200">
          <div className="flex-1 p-2 bg-emerald-50/50 rounded-bl-xl text-center relative border-r border-slate-200">
              <span className="text-[9px] font-bold text-emerald-600 uppercase">True</span>
              <Handle type="source" position={Position.Bottom} id="true" className="!bg-emerald-500 !bottom-[-6px]" />
          </div>
          <div className="flex-1 p-2 bg-red-50/50 rounded-br-xl text-center relative">
               <span className="text-[9px] font-bold text-red-600 uppercase">False</span>
               <Handle type="source" position={Position.Bottom} id="false" className="!bg-red-500 !bottom-[-6px]" />
          </div>
      </div>

    </div>
  );
};

export default React.memo(LogicNode);
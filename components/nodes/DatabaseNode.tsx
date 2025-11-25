import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { BaseNodeData } from '../../types';
import { Database, CheckCircle2, Trash2, FileJson, AlertCircle } from 'lucide-react';

interface DatabaseNodeData extends BaseNodeData {
  actionType?: string;
  mockOutput?: string;
  onChangeAction?: (id: string, value: string) => void;
  onChangeMockOutput?: (id: string, value: string) => void;
}

const DatabaseNode: React.FC<NodeProps<DatabaseNodeData>> = ({ data, id }) => {
  const isError = !!data.error;

  return (
    <div className={`w-64 shadow-md rounded-lg bg-white border-2 overflow-hidden transition-all duration-200 hover:scale-[1.02] hover:shadow-xl relative ${isError ? 'border-red-500 ring-4 ring-red-200' : 'border-blue-500'}`}>
       
       {/* Error Badge */}
       {isError && (
          <div className="absolute top-0 left-0 right-0 bg-red-500 text-white text-[10px] py-1 px-2 z-10 flex items-center justify-center gap-1 animate-pulse">
              <AlertCircle size={12} />
              <span className="font-bold truncate">{data.error}</span>
          </div>
      )}

      {/* Header */}
      <div className={`bg-blue-100 p-3 border-b border-blue-200 flex items-center justify-between ${isError ? 'mt-6' : ''}`}>
        <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-700" />
            <div className="font-bold text-blue-900 text-xs">DB Action</div>
        </div>
        <button 
            className="text-blue-400 hover:text-red-500 transition-colors p-1"
            onClick={() => data.onDelete && data.onDelete(id)}
            title="Delete Node"
        >
            <Trash2 size={14} />
        </button>
      </div>

      {/* Handles */}
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-blue-600 !border-2 !border-white" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-blue-600 !border-2 !border-white" />

      {/* Body */}
      <div className="p-3 space-y-3">
        <div>
            <label className="block text-[10px] font-semibold text-gray-500 uppercase mb-1">Operation Name</label>
            <input
            type="text"
            className="w-full text-xs border border-blue-200 rounded px-2 py-1.5 text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none"
            placeholder="e.g. CheckAvailability"
            value={data.actionType || ''}
            onChange={(e) => data.onChangeAction && data.onChangeAction(id, e.target.value)}
            />
        </div>

        <div>
            <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] font-semibold text-gray-500 uppercase">Mock Response (JSON)</label>
                <FileJson size={10} className="text-blue-400"/>
            </div>
            <textarea 
                className="w-full h-20 text-[10px] font-mono border border-blue-200 rounded p-2 text-gray-600 focus:ring-2 focus:ring-blue-500 outline-none resize-none bg-blue-50/30"
                placeholder='{"result": "success"}'
                value={data.mockOutput || ''}
                onChange={(e) => data.onChangeMockOutput && data.onChangeMockOutput(id, e.target.value)}
            />
        </div>
        
        <div className="flex items-center gap-1 text-[10px] text-blue-400">
            <CheckCircle2 size={10} />
            <span>Transactional Safe</span>
        </div>
      </div>
    </div>
  );
};

export default React.memo(DatabaseNode);
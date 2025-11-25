import React from 'react';
import { Copy, Trash2, Settings, X, Route } from 'lucide-react';

interface ContextMenuProps {
  top: number;
  left: number;
  type: 'node' | 'edge';
  id: string;
  onClose: () => void;
  onDuplicate?: () => void;
  onDelete: () => void;
  onConfigure?: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ 
  top, left, type, onClose, onDuplicate, onDelete, onConfigure 
}) => {
  return (
    <div 
      style={{ top, left }} 
      className="absolute z-50 w-48 bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl border border-slate-100 py-1.5 animate-fadeIn overflow-hidden ring-1 ring-slate-900/5 select-none"
      onMouseLeave={onClose}
    >
      <div className="px-3 py-2 border-b border-slate-100 mb-1 flex items-center justify-between bg-slate-50/50">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {type === 'node' ? 'Node Actions' : 'Connection Actions'}
        </span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X size={12}/></button>
      </div>
      
      {type === 'node' && (
        <>
            <button 
                onClick={onConfigure}
                className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2.5 transition-colors group"
            >
                <Settings size={14} className="text-slate-400 group-hover:text-indigo-500" /> 
                Configure
            </button>

            <button 
                onClick={onDuplicate}
                className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 flex items-center gap-2.5 transition-colors group"
            >
                <Copy size={14} className="text-slate-400 group-hover:text-indigo-500" /> 
                Duplicate
            </button>

            <div className="h-px bg-slate-100 my-1 mx-2"></div>
        </>
      )}

      {type === 'edge' && (
          <div className="px-3 py-2 text-[10px] text-slate-500 italic">
              Remove this connection?
          </div>
      )}

      <button 
        onClick={onDelete}
        className="w-full text-left px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2.5 transition-colors group"
      >
        <Trash2 size={14} className="text-red-400 group-hover:text-red-600" /> 
        Delete
      </button>
    </div>
  );
};
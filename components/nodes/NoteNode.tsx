import React from 'react';
import { NodeProps } from 'reactflow';
import { NoteNodeData } from '../../types';
import { Trash2 } from 'lucide-react';
import { HelpTip } from '../ui/HelpTip';

const COLORS = [
  { value: '#fef3c7', label: 'Yellow' }, // yellow-100
  { value: '#dbeafe', label: 'Blue' },   // blue-100
  { value: '#dcfce7', label: 'Green' },  // green-100
  { value: '#fce7f3', label: 'Pink' },   // pink-100
];

const NoteNode: React.FC<NodeProps<NoteNodeData>> = ({ data, id }) => {
  const handleChange = (text: string) => {
    if (data.onTextChange) {
      data.onTextChange(id, text);
    }
  };

  const handleColorChange = (color: string) => {
    if (data.onColorChange) {
      data.onColorChange(id, color);
    }
  };

  return (
    <div 
      className="shadow-md rounded-lg p-4 min-w-[200px] min-h-[150px] flex flex-col relative group transition-colors duration-300"
      style={{ backgroundColor: data.color || '#fef3c7' }}
    >
      {/* Toolbar (Hidden until hover) */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
         <div className="flex bg-white/50 rounded p-0.5 backdrop-blur-sm">
            {COLORS.map(c => (
                <button
                    key={c.value}
                    onClick={() => handleColorChange(c.value)}
                    className="w-4 h-4 rounded-full border border-black/10 mx-0.5 hover:scale-110 transition-transform"
                    style={{ backgroundColor: c.value }}
                    title={c.label}
                />
            ))}
         </div>
         <button 
            onClick={() => data.onDelete && data.onDelete(id)}
            className="bg-white/50 p-1 rounded hover:bg-red-50 hover:text-red-500 text-gray-500 transition-colors"
         >
             <Trash2 size={12} />
         </button>
      </div>

      <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 uppercase mb-2 tracking-wider select-none">
        Annotation
        <HelpTip content="Add comments or documentation for your team." className="opacity-50 hover:opacity-100" />
      </div>
      
      <textarea
        className="nodrag w-full flex-1 bg-transparent border-none resize-none focus:ring-0 text-sm text-gray-700 font-medium placeholder-gray-400/70 leading-relaxed"
        placeholder="Add documentation here..."
        value={data.text}
        onChange={(e) => handleChange(e.target.value)}
      />
    </div>
  );
};

export default React.memo(NoteNode);

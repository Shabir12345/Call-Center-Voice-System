
import React, { useState } from 'react';
import { NodeType } from '../types';
import { BrainCircuit, Headset, Globe, Code2, FileJson, Variable, Plus, StickyNote, Box, GripVertical, Network, MessageSquare, Database, Split } from 'lucide-react';

const Sidebar: React.FC = () => {
  const [userContext, setUserContext] = useState([
      { key: 'USER_NAME', value: 'John Doe' },
      { key: 'MEMBERSHIP', value: 'Gold' }
  ]);

  const onDragStart = (event: React.DragEvent, nodeType: NodeType, subType?: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    if (subType) {
        event.dataTransfer.setData('application/reactflow-subtype', subType);
    }
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleContextChange = (idx: number, field: 'key' | 'value', val: string) => {
      const newContext = [...userContext];
      newContext[idx] = { ...newContext[idx], [field]: val };
      setUserContext(newContext);
      (window as any).AGENTFLOW_CONTEXT = newContext;
  };

  const addContextVar = () => {
      setUserContext([...userContext, { key: '', value: '' }]);
  };

  // Shared Card Component for draggable items
  const DraggableCard = ({ type, subType, icon: Icon, color, label, desc, badge }: any) => (
      <div
        className="group relative flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl cursor-grab active:cursor-grabbing hover:border-indigo-400 hover:shadow-md transition-all duration-200 select-none active:scale-95"
        onDragStart={(event) => onDragStart(event, type, subType)}
        draggable
      >
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors shrink-0 ${color} shadow-sm`}>
              <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <div className="font-semibold text-slate-700 text-xs leading-none mb-1 group-hover:text-indigo-600 transition-colors">{label}</div>
                {badge && <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">{badge}</span>}
              </div>
              <div className="text-[10px] text-slate-400 leading-tight truncate">{desc}</div>
          </div>
          <div className="text-slate-200 group-hover:text-slate-400 transition-colors">
              <GripVertical size={14} />
          </div>
      </div>
  );

  return (
    <aside className="w-72 h-full bg-slate-50/50 border-r border-slate-200 flex flex-col shadow-sm z-20 font-sans backdrop-blur-xl">
      <div className="p-5 pb-4 border-b border-slate-200/60">
        <h2 className="font-bold text-slate-900 text-sm tracking-tight flex items-center gap-2">
            <div className="p-1 bg-indigo-600 rounded text-white shadow-sm">
                <Box size={14} />
            </div>
            Component Library
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-300">
        
        {/* Logic Section */}
        <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Agents & Logic</div>
            <div className="space-y-2.5">
                <DraggableCard 
                    type={NodeType.ROUTER} 
                    icon={BrainCircuit} 
                    color="bg-gradient-to-br from-purple-100 to-purple-50 text-purple-600 border border-purple-100"
                    label="Master Agent"
                    desc="Voice interface & intent router"
                    badge="Voice"
                />
                <DraggableCard 
                    type={NodeType.DEPARTMENT} 
                    icon={Network} 
                    color="bg-gradient-to-br from-cyan-100 to-cyan-50 text-cyan-600 border border-cyan-100"
                    label="Sub Agent"
                    desc="Specialist department logic"
                    badge="Logic"
                />
                 <DraggableCard 
                    type={NodeType.LOGIC} 
                    icon={Split} 
                    color="bg-gradient-to-br from-rose-100 to-rose-50 text-rose-600 border border-rose-100"
                    label="Condition"
                    desc="If/Else logic branching"
                    badge="Rule"
                />
            </div>
        </div>

        {/* Tools Section */}
        <div>
             <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Capabilities</div>
             <div className="space-y-2.5">
                 <DraggableCard 
                    type={NodeType.SUB_AGENT} 
                    icon={Headset} 
                    color="bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 border border-emerald-100"
                    label="Tool Agent"
                    desc="Executes actions/APIs"
                />
            </div>
        </div>

        {/* Data Integrations Section */}
        <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Data & API</div>
            <div className="space-y-2.5">
                <DraggableCard 
                    type={NodeType.INTEGRATION}
                    subType="rest" 
                    icon={Globe} 
                    color="bg-indigo-50 text-indigo-600"
                    label="REST Client"
                    desc="HTTP endpoints"
                />
                <DraggableCard 
                    type={NodeType.INTEGRATION}
                    subType="graphql" 
                    icon={Code2} 
                    color="bg-pink-50 text-pink-600"
                    label="GraphQL"
                    desc="Queries & mutations"
                />
                <DraggableCard 
                    type={NodeType.INTEGRATION}
                    subType="mock" 
                    icon={FileJson} 
                    color="bg-blue-50 text-blue-600"
                    label="Mock Data"
                    desc="Simulate responses"
                />
            </div>
        </div>

        {/* Utilities */}
        <div>
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Helpers</div>
            <div className="space-y-2.5">
                <DraggableCard 
                    type={NodeType.NOTE}
                    icon={StickyNote} 
                    color="bg-yellow-50 text-yellow-600"
                    label="Sticky Note"
                    desc="Canvas documentation"
                />
            </div>
        </div>

        {/* Context Variables */}
        <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <Variable size={12} />
                    Global Context
                </div>
                <button onClick={addContextVar} className="text-slate-400 hover:text-indigo-600 transition-colors p-1 hover:bg-indigo-50 rounded">
                    <Plus size={12} />
                </button>
            </div>
            
            <div className="space-y-2">
                {userContext.map((ctx, idx) => (
                    <div key={idx} className="flex items-center gap-1 group bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
                        <input 
                            className="w-1/3 text-[10px] px-1.5 py-0.5 bg-transparent text-slate-600 font-bold focus:outline-none placeholder-slate-300 font-mono"
                            value={ctx.key}
                            placeholder="KEY"
                            onChange={(e) => handleContextChange(idx, 'key', e.target.value)}
                        />
                        <span className="text-slate-300">:</span>
                        <input 
                            className="flex-1 text-[10px] px-1.5 py-0.5 bg-transparent text-slate-800 focus:outline-none placeholder-slate-300 font-mono"
                            value={ctx.value}
                            placeholder="Value"
                            onChange={(e) => handleContextChange(idx, 'value', e.target.value)}
                        />
                    </div>
                ))}
            </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
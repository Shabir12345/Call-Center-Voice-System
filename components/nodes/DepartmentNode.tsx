import React, { useState, useCallback, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { DepartmentNodeData, DatabaseConfig } from '../../types';
import { Network, Trash2, AlertCircle, Database, LayoutGrid, Cpu, Plus, X, Edit2, Check, Wrench, Briefcase, ChevronDown, ChevronRight, GripVertical, Wand2, Loader2, ArrowRightLeft } from 'lucide-react';
import { HelpTip } from '../ui/HelpTip';
import { isNotEmpty } from '../../utils/validators';
import { DatabaseConfigPanel } from '../panels/DatabaseConfigPanel';
import { GoogleGenAI } from "@google/genai";

const DepartmentNode: React.FC<NodeProps<DepartmentNodeData>> = ({ data, id }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showDatabase, setShowDatabase] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [localAgentName, setLocalAgentName] = useState(data.agentName || '');
  const [localDescription, setLocalDescription] = useState(data.description || '');
  const [localSystemPrompt, setLocalSystemPrompt] = useState(data.systemPrompt || '');
  const [localBidirectionalEnabled, setLocalBidirectionalEnabled] = useState(data.bidirectionalEnabled ?? true);
  const [localMaxConversationDepth, setLocalMaxConversationDepth] = useState(data.maxConversationDepth ?? 5);
  const [localCommunicationTimeout, setLocalCommunicationTimeout] = useState(data.communicationTimeout ?? 30000);
  const [newTool, setNewTool] = useState('');
  const [isAddingTool, setIsAddingTool] = useState(false);
  const [editingTool, setEditingTool] = useState<string | null>(null);
  const [editToolValue, setEditToolValue] = useState('');

  // AI Loading States
  const [isOptimizingDesc, setIsOptimizingDesc] = useState(false);
  const [isOptimizingPrompt, setIsOptimizingPrompt] = useState(false);

  // Drag and Drop State
  const [draggedTool, setDraggedTool] = useState<number | null>(null);

  useEffect(() => { setLocalAgentName(data.agentName || ''); }, [data.agentName]);
  useEffect(() => { setLocalDescription(data.description || ''); }, [data.description]);
  useEffect(() => { setLocalSystemPrompt(data.systemPrompt || ''); }, [data.systemPrompt]);
  useEffect(() => { setLocalBidirectionalEnabled(data.bidirectionalEnabled ?? true); }, [data.bidirectionalEnabled]);
  useEffect(() => { setLocalMaxConversationDepth(data.maxConversationDepth ?? 5); }, [data.maxConversationDepth]);
  useEffect(() => { setLocalCommunicationTimeout(data.communicationTimeout ?? 30000); }, [data.communicationTimeout]);

  const validate = useCallback((field: string, value: string) => {
      let error = '';
      if (field === 'agentName' && !isNotEmpty(value)) error = 'Required';
      setErrors(prev => {
          const newErrors = { ...prev };
          if (error) newErrors[field] = error;
          else delete newErrors[field];
          return newErrors;
      });
  }, []);

  const handleChange = (field: string, value: any) => {
    if (typeof value === 'string') validate(field, value);
    if (data.onFieldChange) data.onFieldChange(id, field, value);
  };

  const handleBlur = (field: string, value: string) => { handleChange(field, value); };

  const handleAddTool = () => {
    if (newTool && data.onAddTool) {
        data.onAddTool(id, newTool);
        setNewTool('');
        setIsAddingTool(false);
    }
  };

  const startEditingTool = (tool: string) => { setEditingTool(tool); setEditToolValue(tool); };
  const saveEditTool = () => {
      if (editingTool && editToolValue && editToolValue !== editingTool && data.onEditTool) {
          data.onEditTool(id, editingTool, editToolValue);
      }
      setEditingTool(null);
      setEditToolValue('');
  };

  // --- Drag and Drop Handlers ---
  const onDragStart = (e: React.DragEvent, index: number) => {
    e.stopPropagation(); // Stop React Flow dragging
    setDraggedTool(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const onDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (draggedTool === null || draggedTool === targetIndex) {
        setDraggedTool(null);
        return;
    }

    const newTools = [...(data.tools || [])];
    const item = newTools[draggedTool];
    
    // Remove from old index
    newTools.splice(draggedTool, 1);
    // Insert at new index
    newTools.splice(targetIndex, 0, item);

    // Update global state
    handleChange('tools', newTools);
    setDraggedTool(null);
  };

  // --- AI Optimization Logic ---
  const getToolsList = () => {
      return data.tools && data.tools.length > 0 ? data.tools.join(', ') : "None currently connected";
  };

  const optimizeDescription = async () => {
      if (!process.env.API_KEY) { alert("API Key missing"); return; }
      setIsOptimizingDesc(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const prompt = `
            You are an expert AI Systems Architect.
            Refine this "Role Description" for a Department Node in an agentic workflow.
            
            **Architectural Context:**
            1. The Master Agent calls this department to ask questions or get tasks done.
            2. This department DOES NOT speak to the user directly.
            3. This description is used by the Master Agent to know *when* to consult this department.
            
            **Agent Details:**
            - Name: ${localAgentName}
            - Available Tools: [${getToolsList()}]
            
            **Original Description:**
            "${localDescription}"
            
            **Output:**
            Return ONLY the refined description text. 
            Example format: "Consult this agent for [Topics]. It can perform [Actions] using its tools."
          `;
          
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
          });
          if (response.text) {
              const res = response.text.trim();
              setLocalDescription(res);
              handleChange('description', res);
          }
      } catch (e) { console.error(e); } finally { setIsOptimizingDesc(false); }
  };

  const optimizePrompt = async () => {
      if (!process.env.API_KEY) { alert("API Key missing"); return; }
      setIsOptimizingPrompt(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          const prompt = `
            You are an expert AI Systems Architect.
            Refine the "System Prompt" for this Department Sub-Agent.
            
            **Architectural Context:**
            1. **Role:** Backend Logic Advisor.
            2. **User:** The "user" you are talking to is actually the Master Agent, NOT the end customer.
            3. **Goal:** Provide clear instructions, data, or next steps to the Master Agent.
            4. **Tools:** You must use your tools: [${getToolsList()}] to get data.
            
            **Instructions:**
            - If the Master Agent asks a question, use your tools to find the answer.
            - If you need more info from the end customer (like a date or ID), tell the Master Agent: "Please ask the user for [Information]."
            - Do not simulate a conversation with a customer. Be concise and directive to the Master Agent.
            
            **Original Logic:**
            "${localSystemPrompt}"
            
            **Output:**
            Return ONLY the refined system prompt text. No markdown.
          `;
          
          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt
          });
          if (response.text) {
              const res = response.text.trim();
              setLocalSystemPrompt(res);
              handleChange('systemPrompt', res);
          }
      } catch (e) { console.error(e); } finally { setIsOptimizingPrompt(false); }
  };

  const isActive = data.active;
  const isError = !!data.error;

  return (
    <div className={`w-80 rounded-2xl bg-white border shadow-node transition-all duration-300 hover:shadow-node-hover group ${isError ? 'border-red-400 ring-2 ring-red-100' : isActive ? 'border-cyan-400 ring-2 ring-cyan-100 shadow-glow-emerald' : 'border-cyan-200'}`}>
      
      {/* Header */}
      <div 
        className={`p-3 border-b flex items-center justify-between ${isCollapsed ? 'rounded-2xl border-b-0' : 'rounded-t-2xl'} ${isActive ? 'bg-gradient-to-r from-cyan-100 to-cyan-50' : 'bg-gradient-to-r from-cyan-50 to-white'} border-cyan-100 cursor-pointer`}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg shadow-sm ${isActive ? 'bg-cyan-500 text-white' : 'bg-white text-cyan-600 border border-cyan-100'}`}>
            <Network size={16} />
          </div>
          <div>
            <div className="font-bold text-slate-800 text-xs">Sub Agent</div>
            <div className="text-[10px] text-cyan-600 font-medium">Logic Controller</div>
          </div>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {isActive && !isError && <span className="text-[9px] bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full font-bold animate-pulse flex items-center gap-1"><Cpu size={10}/> RUNNING</span>}
            <button className={`${showDatabase ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-blue-500'} p-1.5 rounded-md transition-colors`} onClick={() => setShowDatabase(!showDatabase)}>
                <Database size={14} />
            </button>
            <button className="text-slate-400 hover:text-cyan-600 p-1.5 rounded-md transition-colors" onClick={() => setIsCollapsed(!isCollapsed)}>
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
        </div>
      </div>

      {isError && <div className="bg-red-50 text-red-600 text-[10px] px-3 py-1 border-b border-red-100 flex items-center gap-1 font-medium"><AlertCircle size={10} /> {data.error}</div>}

      <Handle type="target" position={Position.Left} className="!bg-cyan-400" />
      {showDatabase && data.databaseConfig && <DatabaseConfigPanel config={data.databaseConfig} onChange={(c) => data.onDatabaseChange && data.onDatabaseChange(id, c)} />}

      <div className={`p-4 space-y-4 ${isCollapsed ? 'hidden' : ''}`}>
        
        {/* Name Input */}
        <div className="relative">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Department Name</label>
            <div className="relative">
                <input 
                    className={`nodrag w-full text-xs font-semibold text-slate-700 border rounded-lg pl-8 pr-2 py-2 focus:ring-2 focus:ring-cyan-100 focus:border-cyan-400 outline-none transition-all ${errors.agentName ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50 focus:bg-white'}`}
                    placeholder="e.g. Reservations"
                    value={localAgentName}
                    onChange={(e) => setLocalAgentName(e.target.value)}
                    onBlur={(e) => handleBlur('agentName', e.target.value)}
                />
                <Briefcase size={12} className="absolute left-2.5 top-2.5 text-slate-400" />
            </div>
        </div>

        {/* Description */}
        <div>
            <div className="flex items-center justify-between mb-1">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Role Description</label>
                <button onClick={optimizeDescription} disabled={isOptimizingDesc} className="text-[9px] flex items-center gap-1 text-cyan-600 bg-cyan-50 hover:bg-cyan-100 px-1.5 py-0.5 rounded transition-colors border border-cyan-100">
                     {isOptimizingDesc ? <Loader2 size={8} className="animate-spin"/> : <Wand2 size={8}/>} AI Fix
                 </button>
            </div>
            <textarea 
                className="nodrag w-full text-[10px] border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-cyan-100 focus:border-cyan-400 outline-none resize-y min-h-[80px] bg-slate-50 focus:bg-white text-slate-600 leading-relaxed"
                placeholder="Describe when the Master Agent should call this department..."
                value={localDescription}
                onChange={(e) => setLocalDescription(e.target.value)}
                onBlur={(e) => handleBlur('description', e.target.value)}
            />
        </div>

        {/* System Prompt */}
        <div>
             <div className="flex items-center justify-between mb-1">
                 <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Reasoning Logic</label>
                 <button onClick={optimizePrompt} disabled={isOptimizingPrompt} className="text-[9px] flex items-center gap-1 text-cyan-600 bg-cyan-50 hover:bg-cyan-100 px-1.5 py-0.5 rounded transition-colors border border-cyan-100">
                     {isOptimizingPrompt ? <Loader2 size={8} className="animate-spin"/> : <Wand2 size={8}/>} AI Fix
                 </button>
             </div>
            <textarea 
                className="nodrag w-full text-[10px] border border-slate-200 rounded-lg p-2.5 focus:ring-2 focus:ring-cyan-100 focus:border-cyan-400 outline-none resize-y min-h-[100px] bg-slate-50 focus:bg-white text-slate-600 font-mono leading-relaxed"
                placeholder="Instructions for the sub-agent..."
                value={localSystemPrompt}
                onChange={(e) => setLocalSystemPrompt(e.target.value)}
                onBlur={(e) => handleBlur('systemPrompt', e.target.value)}
            />
        </div>

        {/* Bidirectional Communication Settings */}
        <div className="border-t border-slate-100 pt-3 mt-3">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <ArrowRightLeft size={10} className="text-purple-500"/> Bidirectional Communication
            </label>
            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-600">Enable Bidirectional</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={localBidirectionalEnabled}
                            onChange={(e) => {
                                setLocalBidirectionalEnabled(e.target.checked);
                                handleChange('bidirectionalEnabled', e.target.checked);
                            }}
                            className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                    </label>
                </div>
                {localBidirectionalEnabled && (
                    <>
                        <div>
                            <label className="text-[9px] text-slate-500 mb-1 block">Max Conversation Depth</label>
                            <input
                                type="number"
                                min="1"
                                max="10"
                                value={localMaxConversationDepth}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value) || 5;
                                    setLocalMaxConversationDepth(val);
                                    handleChange('maxConversationDepth', val);
                                }}
                                className="nodrag w-full text-xs border border-slate-200 rounded px-2 py-1 bg-slate-50 focus:bg-white focus:border-purple-400 focus:ring-1 focus:ring-purple-200"
                            />
                        </div>
                        <div>
                            <label className="text-[9px] text-slate-500 mb-1 block">Communication Timeout (ms)</label>
                            <input
                                type="number"
                                min="1000"
                                max="60000"
                                step="1000"
                                value={localCommunicationTimeout}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value) || 30000;
                                    setLocalCommunicationTimeout(val);
                                    handleChange('communicationTimeout', val);
                                }}
                                className="nodrag w-full text-xs border border-slate-200 rounded px-2 py-1 bg-slate-50 focus:bg-white focus:border-purple-400 focus:ring-1 focus:ring-purple-200"
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
      </div>

      {/* Tools - Always visible for connections */}
      <div className={`p-4 pt-0 ${isCollapsed ? 'pt-2' : ''}`}>
            <label className={`text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1 border-t border-slate-100 pt-3 ${isCollapsed ? 'pt-0 border-t-0' : ''}`}>
                <Wrench size={10} className="text-cyan-500"/> Tool Connections
            </label>
            <div className="space-y-1.5">
                {data.tools?.map((tool, index) => (
                    <div 
                        key={`${id}-tool-${index}`} 
                        className={`relative flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border shadow-sm group transition-all nodrag ${draggedTool === index ? 'opacity-50 border-dashed border-cyan-400' : 'border-slate-200 hover:border-cyan-300'}`}
                        draggable
                        onDragStart={(e) => onDragStart(e, index)}
                        onDragOver={(e) => onDragOver(e, index)}
                        onDrop={(e) => onDrop(e, index)}
                    >
                        {editingTool === tool && !isCollapsed ? (
                            <div className="flex items-center gap-1 w-full">
                                <input className="nodrag w-full text-xs bg-slate-50 border-none p-0 focus:ring-0" value={editToolValue} onChange={(e) => setEditToolValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveEditTool()} autoFocus />
                                <button onClick={saveEditTool} className="text-green-500"><Check size={12}/></button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 w-full">
                                <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-cyan-500" title="Drag to reorder">
                                    <GripVertical size={10} />
                                </div>
                                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-sm"></div>
                                <span className="text-xs font-medium text-slate-700 truncate flex-1 select-none">{tool}</span>
                                {!isCollapsed && (
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => startEditingTool(tool)} className="text-slate-400 hover:text-cyan-500"><Edit2 size={10}/></button>
                                        <button onClick={() => data.onRemoveTool && data.onRemoveTool(id, tool)} className="text-slate-400 hover:text-red-500"><X size={10}/></button>
                                    </div>
                                )}
                            </div>
                        )}
                        <Handle type="source" position={Position.Right} id={`tool-${tool}`} className="!bg-cyan-500 !border-white" style={{ right: -6 }} />
                    </div>
                ))}
            </div>
            {!isCollapsed && (
                isAddingTool ? (
                    <div className="flex gap-1 mt-2 animate-fadeIn">
                        <input className="nodrag flex-1 text-xs border border-cyan-200 rounded px-2 py-1 focus:outline-none focus:border-cyan-400" placeholder="Tool Name..." value={newTool} onChange={(e) => setNewTool(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddTool()} autoFocus />
                        <button onClick={handleAddTool} className="bg-cyan-600 text-white p-1 rounded hover:bg-cyan-700"><Plus size={14}/></button>
                    </div>
                ) : (
                    <button onClick={() => setIsAddingTool(true)} className="w-full mt-2 flex items-center justify-center gap-1 text-[10px] font-bold text-cyan-600 bg-cyan-50 hover:bg-cyan-100 py-1.5 rounded-lg transition-colors border border-cyan-100 border-dashed">
                        <Plus size={12} /> Add Tool Link
                    </button>
                )
            )}
        </div>

    </div>
  );
};

export default React.memo(DepartmentNode);
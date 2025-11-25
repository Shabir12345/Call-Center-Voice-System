import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { RouterNodeData, DatabaseConfig, VoiceSettings } from '../../types';
import { BrainCircuit, Plus, X, Sparkles, Trash2, FileText, AlertCircle, Edit2, Check, Database, Settings, Volume2, Mic, Gauge, ChevronDown, ChevronRight, Wand2, ShieldAlert, Loader2, MessageSquarePlus, User, Mic2, GripVertical, ArrowRightLeft } from 'lucide-react';
import { HelpTip } from '../ui/HelpTip';
import { isNotEmpty } from '../../utils/validators';
import { DatabaseConfigPanel } from '../panels/DatabaseConfigPanel';
import { GoogleGenAI } from "@google/genai";

// Gemini Live API Voices
const VOICE_OPTIONS = [
  { value: 'Zephyr', label: 'Zephyr (Male, Deep)' },
  { value: 'Puck', label: 'Puck (Male, Energetic)' },
  { value: 'Charon', label: 'Charon (Male, Formal)' },
  { value: 'Kore', label: 'Kore (Female, Calm)' },
  { value: 'Fenrir', label: 'Fenrir (Male, Intense)' },
  { value: 'Aoede', label: 'Aoede (Female, Smooth)' },
];

const STYLE_OPTIONS = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'human', label: 'Hyper-Realistic (Human)' },
  { value: 'empathetic', label: 'Empathetic' },
  { value: 'humorous', label: 'Humorous' },
];

const RouterNode: React.FC<NodeProps<RouterNodeData>> = ({ data, id }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [newIntent, setNewIntent] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [showDatabase, setShowDatabase] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const templateMenuRef = useRef<HTMLDivElement>(null);
  
  const [localAgentName, setLocalAgentName] = useState(data.agentName || '');
  const [localSystemPrompt, setLocalSystemPrompt] = useState(data.systemPrompt || '');
  const [localFirstSentence, setLocalFirstSentence] = useState(data.firstSentence || '');
  const [localBidirectionalEnabled, setLocalBidirectionalEnabled] = useState(data.bidirectionalEnabled ?? true);
  const [localAllowSubAgentQueries, setLocalAllowSubAgentQueries] = useState(data.allowSubAgentQueries ?? true);
  const [localCommunicationTimeout, setLocalCommunicationTimeout] = useState(data.communicationTimeout ?? 30000);
  const [editingIntent, setEditingIntent] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Drag and Drop State
  const [draggedIntent, setDraggedIntent] = useState<number | null>(null);

  useEffect(() => { setLocalAgentName(data.agentName || ''); }, [data.agentName]);
  useEffect(() => { setLocalSystemPrompt(data.systemPrompt || ''); }, [data.systemPrompt]);
  useEffect(() => { setLocalFirstSentence(data.firstSentence || ''); }, [data.firstSentence]);
  useEffect(() => { setLocalBidirectionalEnabled(data.bidirectionalEnabled ?? true); }, [data.bidirectionalEnabled]);
  useEffect(() => { setLocalAllowSubAgentQueries(data.allowSubAgentQueries ?? true); }, [data.allowSubAgentQueries]);
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

  useEffect(() => {
     if (!data.agentName) validate('agentName', '');
  }, []);

  const handleAdd = useCallback(() => {
    if (newIntent && data.onAddIntent) {
      data.onAddIntent(id, newIntent);
      setNewIntent('');
      setIsAdding(false);
    }
  }, [newIntent, data, id]);

  const startEditing = (intent: string) => { setEditingIntent(intent); setEditValue(intent); };
  const saveEdit = () => {
      if (editingIntent && editValue && editValue !== editingIntent && data.onEditIntent) {
          data.onEditIntent(id, editingIntent, editValue);
      }
      setEditingIntent(null);
      setEditValue('');
  };

  const handleChange = (field: string, value: any) => {
    if (typeof value === 'string') validate(field, value);
    if (data.onFieldChange) data.onFieldChange(id, field, value);
  };
  const handleBlur = (field: string, value: string) => { handleChange(field, value); };

  const handleVoiceSettingsChange = (field: keyof VoiceSettings, value: any) => {
      if (data.onVoiceSettingsChange && data.voiceSettings) {
          data.onVoiceSettingsChange(id, { ...data.voiceSettings, [field]: value });
      }
  };

  const optimizePrompt = async () => {
      if (!process.env.API_KEY) { alert("API Key missing"); return; }
      setIsOptimizing(true);
      try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          
          // Construct a context-aware prompt
          const intentsList = data.intents && data.intents.length > 0 
            ? data.intents.join(', ') 
            : "No specific capabilities connected yet";

          const metaPrompt = `
            You are an expert AI Voice Agent Architect. 
            Rewrite the "System Prompt" for a Master Orchestrator Agent named "${localAgentName}".
            
            **Architectural Rules:**
            1. **Single Voice Policy:** This Master Agent is the ONLY agent the user speaks to. It must NEVER say "I am transferring you" or "Hold on while I connect you".
            2. **Orchestration:** When the user needs something specific (defined in the Capabilities below), the Master Agent must use its tools to *consult* the backend departments silently, then relay the information/question to the user in its own voice.
            3. **Personality:** The agent's personality style must be: ${data.style}.
            
            **Connected Capabilities (Tools):**
            [${intentsList}]
            
            **Instructions to the Agent:**
            - You are the face of the company.
            - If the user asks about a topic in your capabilities, DO NOT say "I can't help with that".
            - Instead, call the corresponding tool (e.g., consult_reservations) to get instructions on what to ask the user next.
            - Act as a concierge: You take the user's request, turn to your backend team (the tools) for an answer, and then turn back to the user with the result.
            
            **Original Prompt Draft:** 
            "${localSystemPrompt}"
            
            **Output:**
            Return ONLY the rewritten, high-quality system prompt. Do not add markdown formatting or explanations.
          `;

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: metaPrompt
          });
          
          if (response.text) {
              const optimized = response.text.trim();
              setLocalSystemPrompt(optimized);
              handleChange('systemPrompt', optimized);
          }
      } catch (e) { console.error(e); } finally { setIsOptimizing(false); }
  };

  // --- Drag and Drop Handlers ---
  const onDragStart = (e: React.DragEvent, index: number) => {
    // IMPORTANT: stopPropagation prevents React Flow from dragging the node itself
    e.stopPropagation();
    setDraggedIntent(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const onDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault(); // Necessary to allow dropping
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
  };

  const onDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (draggedIntent === null || draggedIntent === targetIndex) {
        setDraggedIntent(null);
        return;
    }

    const newIntents = [...(data.intents || [])];
    const item = newIntents[draggedIntent];
    
    // Remove from old index
    newIntents.splice(draggedIntent, 1);
    // Insert at new index
    newIntents.splice(targetIndex, 0, item);

    // Update global state
    handleChange('intents', newIntents);
    setDraggedIntent(null);
  };

  const isActive = data.active;
  const isError = !!data.error;
  const voiceSettings = data.voiceSettings || { speed: 1.0, interruptible: true, fillerWords: false };

  return (
    <div className={`w-80 rounded-2xl bg-white border shadow-node transition-all duration-300 hover:shadow-node-hover group ${isError ? 'border-red-400 ring-2 ring-red-100' : isActive ? 'border-purple-400 ring-2 ring-purple-100 shadow-glow-indigo' : 'border-purple-200'}`}>
      
      {/* Active Header */}
      <div 
        className={`p-3 border-b flex items-center justify-between ${isCollapsed ? 'rounded-2xl border-b-0' : 'rounded-t-2xl'} ${isActive ? 'bg-gradient-to-r from-purple-100 to-purple-50' : 'bg-gradient-to-r from-purple-50 to-white'} border-purple-100 cursor-pointer`}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg shadow-sm ${isActive ? 'bg-purple-500 text-white' : 'bg-white text-purple-600 border border-purple-100'}`}>
             <BrainCircuit size={16} />
          </div>
          <div>
              <div className="font-bold text-slate-800 text-xs">Master Agent</div>
              <div className="text-[10px] text-purple-500 font-medium">Voice Interface</div>
          </div>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {isActive && !isError && <div className="flex items-center gap-1 bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full text-[9px] font-bold"><Mic size={10} className="animate-pulse" /> LIVE</div>}
            <button className={`${showDatabase ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-blue-500'} p-1.5 rounded-md transition-colors`} onClick={() => setShowDatabase(!showDatabase)} title="DB">
                <Database size={14} />
            </button>
            <button className="text-slate-400 hover:text-indigo-500 p-1.5 rounded-md transition-colors" onClick={() => setIsCollapsed(!isCollapsed)}>
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
        </div>
      </div>

      {isError && <div className="bg-red-50 text-red-600 text-[10px] px-3 py-1 border-b border-red-100 flex items-center gap-1 font-medium"><AlertCircle size={10} /> {data.error}</div>}

      <Handle type="target" position={Position.Top} className="!bg-purple-500" />
      {showDatabase && data.databaseConfig && <DatabaseConfigPanel config={data.databaseConfig} onChange={(c) => data.onDatabaseChange && data.onDatabaseChange(id, c)} />}

      <div className={`p-4 space-y-4 ${isCollapsed ? 'hidden' : ''}`}>
        {/* Core Identity */}
        <div className="space-y-3">
             <div className="relative">
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Agent Name</label>
                <input 
                    className={`nodrag w-full text-xs font-semibold text-slate-700 border rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-purple-100 focus:border-purple-400 outline-none transition-all ${errors.agentName ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50 focus:bg-white'}`}
                    placeholder="e.g. Concierge"
                    value={localAgentName}
                    onChange={(e) => setLocalAgentName(e.target.value)}
                    onBlur={(e) => handleBlur('agentName', e.target.value)}
                />
             </div>
             <div className="grid grid-cols-2 gap-2">
                 <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Voice Model</label>
                    <div className="relative">
                        <select className="nodrag w-full text-[10px] border border-slate-200 rounded-lg pl-2 pr-4 py-1.5 bg-white focus:ring-2 focus:ring-purple-100 outline-none appearance-none cursor-pointer hover:border-purple-300 transition-colors"
                            value={data.voiceId || 'Zephyr'} onChange={(e) => handleChange('voiceId', e.target.value)}>
                            {VOICE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                        <ChevronDown size={10} className="absolute right-2 top-2.5 text-slate-400 pointer-events-none"/>
                    </div>
                 </div>
                 <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Personality</label>
                    <div className="relative">
                        <select className="nodrag w-full text-[10px] border border-slate-200 rounded-lg pl-2 pr-4 py-1.5 bg-white focus:ring-2 focus:ring-purple-100 outline-none appearance-none cursor-pointer hover:border-purple-300 transition-colors"
                            value={data.style || 'professional'} onChange={(e) => handleChange('style', e.target.value)}>
                            {STYLE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                        <Sparkles size={10} className="absolute right-2 top-2.5 text-purple-400 pointer-events-none"/>
                    </div>
                 </div>
             </div>
        </div>

        {/* Configurations */}
        <div className="bg-slate-50 rounded-xl p-0.5 border border-slate-100 gap-0.5 flex flex-col">
             {/* Opener Config */}
             <div className="bg-white rounded-lg p-2.5 shadow-sm border border-slate-100">
                 <div className="flex items-center justify-between mb-2">
                     <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700">
                         <MessageSquarePlus size={12} className="text-purple-500"/> First Message
                     </span>
                     <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={data.speaksFirst} onChange={() => handleChange('speaksFirst', !data.speaksFirst)} />
                        <div className="w-7 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-purple-500"></div>
                     </label>
                 </div>
                 {data.speaksFirst && (
                     <textarea className="nodrag w-full text-[10px] border border-purple-100 rounded-md p-2 bg-purple-50/30 focus:bg-white focus:border-purple-300 outline-none resize-y h-12 transition-colors"
                         placeholder="Greeting..." value={localFirstSentence} onChange={(e) => setLocalFirstSentence(e.target.value)} onBlur={(e) => handleBlur('firstSentence', e.target.value)} />
                 )}
             </div>

             {/* Voice Settings */}
             <div className="bg-white rounded-lg p-2.5 shadow-sm border border-slate-100 mt-1">
                 <div className="flex items-center gap-1.5 mb-2 text-[10px] font-bold text-slate-700">
                     <Settings size={12} className="text-purple-500"/> Voice Controls
                 </div>
                 <div className="flex items-center gap-3">
                     <div className="flex-1">
                        <div className="flex justify-between mb-1"><span className="text-[9px] text-slate-400 font-bold uppercase">Speed</span> <span className="text-[9px] font-mono">{voiceSettings.speed}x</span></div>
                        <input type="range" min="0.5" max="2.0" step="0.1" className="nodrag w-full h-1 bg-slate-200 rounded-lg accent-purple-500 cursor-pointer" value={voiceSettings.speed} onChange={(e) => handleVoiceSettingsChange('speed', parseFloat(e.target.value))} />
                     </div>
                     <div className="flex gap-2">
                        <button onClick={() => handleVoiceSettingsChange('fillerWords', !voiceSettings.fillerWords)} className={`p-1.5 rounded-md border transition-all ${voiceSettings.fillerWords ? 'bg-purple-50 border-purple-200 text-purple-600' : 'bg-slate-50 border-slate-100 text-slate-300'}`} title="Filler Words"><Mic2 size={12}/></button>
                        <button onClick={() => handleVoiceSettingsChange('interruptible', !voiceSettings.interruptible)} className={`p-1.5 rounded-md border transition-all ${voiceSettings.interruptible ? 'bg-purple-50 border-purple-200 text-purple-600' : 'bg-slate-50 border-slate-100 text-slate-300'}`} title="Interruptible"><Volume2 size={12}/></button>
                     </div>
                 </div>
             </div>
        </div>

        {/* System Prompt */}
        <div>
             <div className="flex items-center justify-between mb-1">
                 <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">System Prompt</label>
                 <div className="flex gap-1">
                     <button onClick={optimizePrompt} disabled={isOptimizing} className="text-[9px] flex items-center gap-1 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded transition-colors border border-indigo-100">
                         {isOptimizing ? <Loader2 size={8} className="animate-spin"/> : <Wand2 size={8}/>} AI Fix
                     </button>
                 </div>
             </div>
             <div className="relative group">
                <textarea 
                    className={`nodrag w-full text-[10px] border rounded-lg p-2.5 min-h-[100px] resize-y focus:ring-2 focus:ring-purple-100 focus:border-purple-400 outline-none leading-relaxed text-slate-600 ${errors.systemPrompt ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50 focus:bg-white'}`}
                    placeholder="Define agent behavior..." 
                    value={localSystemPrompt} 
                    onChange={(e) => setLocalSystemPrompt(e.target.value)} 
                    onBlur={(e) => handleBlur('systemPrompt', e.target.value)} 
                />
             </div>
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
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-slate-600">Allow Sub-Agent Queries</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={localAllowSubAgentQueries}
                                    onChange={(e) => {
                                        setLocalAllowSubAgentQueries(e.target.checked);
                                        handleChange('allowSubAgentQueries', e.target.checked);
                                    }}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                            </label>
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

      {/* Tool Connections */}
      <div className={`p-4 pt-0 ${isCollapsed ? 'pt-2' : ''}`}>
          <label className={`text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1 ${isCollapsed ? 'mb-1' : ''}`}>
              Connected Capabilities <HelpTip content="Link to other nodes" />
          </label>
          <div className="space-y-1.5">
          {data.intents.map((intent, index) => (
              <div 
                key={`${id}-intent-${index}`} 
                className={`relative flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border shadow-sm group transition-all nodrag ${draggedIntent === index ? 'opacity-50 border-dashed border-purple-400' : 'border-slate-200 hover:border-purple-300'}`}
                draggable
                onDragStart={(e) => onDragStart(e, index)}
                onDragOver={(e) => onDragOver(e, index)}
                onDrop={(e) => onDrop(e, index)}
              >
                  {editingIntent === intent && !isCollapsed ? (
                      <div className="flex items-center gap-1 w-full">
                          <input className="nodrag w-full text-xs bg-slate-50 border-none p-0 focus:ring-0" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && saveEdit()} autoFocus />
                          <button onClick={saveEdit} className="text-green-500"><Check size={12}/></button>
                      </div>
                  ) : (
                      <div className="flex items-center gap-2 w-full">
                          <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-purple-400" title="Drag to reorder">
                            <GripVertical size={10} />
                          </div>
                          <div className="w-1.5 h-1.5 rounded-full bg-purple-400 shadow-sm"></div>
                          <span className="text-xs font-medium text-slate-700 truncate flex-1 select-none">{intent}</span>
                          {!isCollapsed && (
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => startEditing(intent)} className="text-slate-400 hover:text-purple-500"><Edit2 size={10}/></button>
                                <button onClick={() => data.onRemoveIntent && data.onRemoveIntent(id, intent)} className="text-slate-400 hover:text-red-500"><X size={10}/></button>
                            </div>
                          )}
                      </div>
                  )}
                  {/* Clean Handle - Global CSS handles size/hit area */}
                  <Handle 
                    type="source" 
                    position={Position.Right} 
                    id={`intent-${intent}`} 
                    className="!bg-purple-500 !border-white" 
                    style={{ right: -6 }} 
                   />
              </div>
          ))}
          </div>
          {!isCollapsed && (
            isAdding ? (
                <div className="flex gap-1 mt-2 animate-fadeIn">
                    <input className="nodrag flex-1 text-xs border border-purple-200 rounded px-2 py-1 focus:outline-none focus:border-purple-400" placeholder="Capability Name..." value={newIntent} onChange={(e) => setNewIntent(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAdd()} autoFocus />
                    <button onClick={handleAdd} className="bg-purple-600 text-white p-1 rounded hover:bg-purple-700"><Plus size={14}/></button>
                </div>
            ) : (
                <button onClick={() => setIsAdding(true)} className="w-full mt-2 flex items-center justify-center gap-1 text-[10px] font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 py-1.5 rounded-lg transition-colors border border-purple-100 border-dashed">
                    <Plus size={12} /> Add Capability
                </button>
            )
          )}
      </div>

    </div>
  );
};

export default React.memo(RouterNode);
import React, { useState, useCallback, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { SubAgentNodeData, AgentParameter, DatabaseConfig, VoiceSettings } from '../../types';
import { Bot, Shield, ArrowRight, Briefcase, Trash2, AlertCircle, Database, ChevronDown, ChevronRight, Plus, Code, Brackets, Link, Settings, Gauge, Mic, Volume2, Target, Award, Check } from 'lucide-react';
import { HelpTip } from '../ui/HelpTip';
import { isNotEmpty, isValidJson } from '../../utils/validators';
import { DatabaseConfigPanel } from '../panels/DatabaseConfigPanel';

const ACCESS_LEVELS = [
  { value: 'read_only', label: 'Read Only' },
  { value: 'write', label: 'Read & Write' },
  { value: 'admin', label: 'Admin Access' },
];

const SubAgentNode: React.FC<NodeProps<SubAgentNodeData>> = ({ data, id }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showDatabase, setShowDatabase] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [localAgentName, setLocalAgentName] = useState(data.agentName || '');
  const [localDescription, setLocalDescription] = useState(data.description || '');
  const [localOutputSchema, setLocalOutputSchema] = useState(data.outputSchema || '');
  const [localSpecialty, setLocalSpecialty] = useState(data.specialty || '');
  const [localFunctionName, setLocalFunctionName] = useState(data.functionName || '');
  const [localApiEndpoint, setLocalApiEndpoint] = useState(data.apiEndpoint || '');

  useEffect(() => setLocalAgentName(data.agentName || ''), [data.agentName]);
  useEffect(() => setLocalDescription(data.description || ''), [data.description]);
  useEffect(() => setLocalOutputSchema(data.outputSchema || ''), [data.outputSchema]);
  useEffect(() => setLocalSpecialty(data.specialty || ''), [data.specialty]);
  useEffect(() => setLocalFunctionName(data.functionName || ''), [data.functionName]);
  useEffect(() => setLocalApiEndpoint(data.apiEndpoint || ''), [data.apiEndpoint]);

  const validate = useCallback((field: string, value: string) => {
      let error = '';
      if (field === 'agentName' && !isNotEmpty(value)) error = 'Required';
      if (field === 'apiEndpoint' && !isNotEmpty(value)) error = 'Required';
      if (field === 'outputSchema' && !isValidJson(value)) error = 'Invalid JSON';
      setErrors(prev => { const newErrors = { ...prev }; if(error) newErrors[field]=error; else delete newErrors[field]; return newErrors; });
  }, []);
  
  const handleChange = (field: string, value: string | boolean) => {
    if (typeof value === 'string') validate(field, value);
    if (data.onFieldChange) data.onFieldChange(id, field, value);
  };
  const handleBlur = (field: string, value: string) => { handleChange(field, value); };

  const handleAddParam = () => {
    if (data.onParamsChange) {
        data.onParamsChange(id, [...(data.parameters || []), { id: Math.random().toString(36).substr(2, 9), name: 'new_arg', type: 'string', description: '', required: true }]);
    }
  };
  const handleUpdateParam = (paramId: string, field: keyof AgentParameter, value: any) => {
      if (data.onParamsChange && data.parameters) {
          data.onParamsChange(id, data.parameters.map(p => p.id === paramId ? { ...p, [field]: value } : p));
      }
  };
  const handleRemoveParam = (paramId: string) => {
      if (data.onParamsChange && data.parameters) {
          data.onParamsChange(id, data.parameters.filter(p => p.id !== paramId));
      }
  };

  const isActive = data.active;
  const isError = !!data.error;
  const isGoal = !!data.isGoal;

  return (
    <div className={`w-72 rounded-2xl bg-white border shadow-node transition-all duration-300 hover:shadow-node-hover group ${isError ? 'border-red-400 ring-2 ring-red-100' : isActive ? 'border-emerald-400 ring-4 ring-emerald-200 shadow-glow-emerald animate-pulse-glow' : isGoal ? 'border-amber-400 ring-2 ring-amber-100' : 'border-emerald-200'}`}>
      
      {/* Header */}
      <div 
        className={`p-3 border-b flex items-center justify-between ${isCollapsed ? 'rounded-2xl border-b-0' : 'rounded-t-2xl'} ${isActive ? 'bg-gradient-to-r from-emerald-100 to-emerald-50' : isGoal ? 'bg-gradient-to-r from-amber-50 to-white' : 'bg-gradient-to-r from-emerald-50 to-white'} ${isGoal ? 'border-amber-200' : 'border-emerald-100'} cursor-pointer`}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg shadow-sm ${isActive ? 'bg-emerald-500 text-white' : isGoal ? 'bg-amber-100 text-amber-600 border border-amber-200' : 'bg-white text-emerald-600 border border-emerald-100'}`}>
             {isGoal ? <Target size={16} /> : <Bot size={16} />}
          </div>
          <div>
            <div className="font-bold text-slate-800 text-xs">Tool Agent</div>
            <div className={`text-[10px] font-medium ${isGoal ? 'text-amber-500' : 'text-emerald-500'}`}>{isGoal ? 'Success Trigger' : 'Execution Unit'}</div>
          </div>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {isActive && !isError && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold animate-pulse flex items-center gap-1"><Bot size={10}/> RUNNING</span>}
            <button className={`${showDatabase ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-blue-500'} p-1.5 rounded-md transition-colors`} onClick={() => setShowDatabase(!showDatabase)}>
                <Database size={14} />
            </button>
            <button className="text-slate-400 hover:text-emerald-600 p-1.5 rounded-md transition-colors" onClick={() => setIsCollapsed(!isCollapsed)}>
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
        </div>
      </div>

      {isError && <div className="bg-red-50 text-red-600 text-[10px] px-3 py-1 border-b border-red-100 flex items-center gap-1 font-medium"><AlertCircle size={10} /> {data.error}</div>}

      <Handle type="target" position={Position.Left} className={isGoal ? '!bg-amber-400' : '!bg-emerald-400'} />
      <Handle type="source" position={Position.Right} className={isGoal ? '!bg-amber-400' : '!bg-emerald-400'} />
      {showDatabase && data.databaseConfig && <DatabaseConfigPanel config={data.databaseConfig} onChange={(c) => data.onDatabaseChange && data.onDatabaseChange(id, c)} />}

      {!isCollapsed && (
          <div className="p-4 space-y-4 animate-fadeIn">
            {/* Name */}
            <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Function Name</label>
                <input 
                    className={`nodrag w-full text-xs font-mono font-medium text-slate-700 border rounded-lg px-2.5 py-2 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 outline-none transition-all ${errors.agentName ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-slate-50 focus:bg-white'}`}
                    placeholder="e.g. check_inventory"
                    value={localAgentName}
                    onChange={(e) => setLocalAgentName(e.target.value)}
                    onBlur={(e) => handleBlur('agentName', e.target.value)}
                />
            </div>

            {/* Specialty */}
            <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Domain</label>
                <div className="relative">
                    <input list={`specialty-options-${id}`} className="nodrag w-full text-xs border border-slate-200 rounded-lg pl-2 pr-8 py-2 bg-white text-slate-700 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-400 outline-none"
                        placeholder="Select..." value={localSpecialty} onChange={(e) => setLocalSpecialty(e.target.value)} onBlur={(e) => handleBlur('specialty', e.target.value)} />
                    <datalist id={`specialty-options-${id}`}>
                        <option value="reservations"/><option value="tech_support"/><option value="billing"/><option value="general_info"/><option value="hr"/>
                    </datalist>
                    <Briefcase size={12} className="absolute right-3 top-2.5 text-slate-300 pointer-events-none" />
                </div>
            </div>

            {/* Goal Toggle */}
            <div className={`rounded-lg p-3 border transition-colors ${isGoal ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isGoal ? 'bg-amber-500 border-amber-600 text-white' : 'bg-white border-slate-300'}`}
                            onClick={() => handleChange('isGoal', !isGoal)}>
                            {isGoal && <Check size={10} strokeWidth={4} />}
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-wider ${isGoal ? 'text-amber-700' : 'text-slate-500'}`}>Track as Success</span>
                    </label>
                    {isGoal && <Award size={14} className="text-amber-500" />}
                </div>
                {isGoal && (
                    <textarea className="nodrag w-full mt-2 text-[10px] border border-amber-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-amber-400 h-10 resize-none animate-fadeIn"
                        placeholder="Success Criteria..." value={data.successCriteria || ''} onChange={(e) => handleChange('successCriteria', e.target.value)} />
                )}
            </div>

            {/* Advanced Config */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
                <button onClick={() => setShowConfig(!showConfig)} className="w-full flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 transition-colors">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 uppercase">
                        <Code size={12} className="text-emerald-500" /> Interface Def
                    </div>
                    {showConfig ? <ChevronDown size={12} className="text-slate-400"/> : <ChevronRight size={12} className="text-slate-400"/>}
                </button>
                {showConfig && (
                    <div className="p-3 bg-white space-y-3 animate-fadeIn border-t border-slate-200">
                        <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase mb-1 block">API Path</label>
                            <div className="relative">
                                <input className="nodrag w-full text-[10px] font-mono border border-slate-200 rounded pl-7 pr-2 py-1.5 focus:border-emerald-400 outline-none"
                                    placeholder="/v1/resource" value={localApiEndpoint} onChange={(e) => setLocalApiEndpoint(e.target.value)} onBlur={(e) => handleBlur('apiEndpoint', e.target.value)} />
                                <Link size={10} className="absolute left-2.5 top-2 text-slate-400" />
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <label className="text-[9px] font-bold text-slate-400 uppercase">Parameters</label>
                                <button onClick={handleAddParam} className="text-[9px] text-emerald-600 hover:text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded flex items-center gap-1"><Plus size={8} /> Add</button>
                            </div>
                            <div className="space-y-1.5">
                                {data.parameters?.map((param) => (
                                    <div key={param.id} className="flex gap-1 items-center bg-slate-50 p-1 rounded border border-slate-100">
                                        <input className="nodrag w-16 text-[10px] font-mono bg-transparent border-none p-0 focus:ring-0 text-slate-700 font-bold" placeholder="name" value={param.name} onChange={(e) => handleUpdateParam(param.id, 'name', e.target.value)} />
                                        <span className="text-slate-300">:</span>
                                        <select className="nodrag text-[9px] bg-transparent border-none p-0 focus:ring-0 text-slate-500 w-12" value={param.type} onChange={(e) => handleUpdateParam(param.id, 'type', e.target.value)}>
                                            <option value="string">str</option><option value="number">num</option><option value="boolean">bool</option><option value="json">json</option>
                                        </select>
                                        <button onClick={() => handleRemoveParam(param.id)} className="ml-auto text-slate-300 hover:text-red-400"><Trash2 size={10} /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Bottom Output */}
            <div className="pt-2 border-t border-slate-100 flex items-center gap-2 justify-end text-[9px] font-medium text-slate-400">
                <span>Returns JSON</span> <ArrowRight size={10} />
            </div>
          </div>
      )}
    </div>
  );
};

export default React.memo(SubAgentNode);
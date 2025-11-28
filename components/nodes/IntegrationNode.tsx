import React, { useState, useCallback, useEffect } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { IntegrationNodeData, DatabaseConfig } from '../../types';
import { Globe, Trash2, FileJson, AlertCircle, Settings, Shield, ChevronDown, ChevronRight, Code2, Sparkles, Key, Play, Check, X, Database, Clock, Activity, Zap, Calendar } from 'lucide-react';
import { HelpTip } from '../ui/HelpTip';
import { isValidJson, isValidUrl } from '../../utils/validators';
import { DatabaseConfigPanel } from '../panels/DatabaseConfigPanel';

const IntegrationNode: React.FC<NodeProps<IntegrationNodeData>> = ({ data, id }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showDatabase, setShowDatabase] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const [localMockOutput, setLocalMockOutput] = useState(data.mockOutput || '');
  const [localUrl, setLocalUrl] = useState(data.url || '');
  const [localGraphQLQuery, setLocalGraphQLQuery] = useState(data.graphQLQuery || '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => setLocalMockOutput(data.mockOutput || ''), [data.mockOutput]);
  useEffect(() => setLocalUrl(data.url || ''), [data.url]);
  useEffect(() => setLocalGraphQLQuery(data.graphQLQuery || ''), [data.graphQLQuery]);

  const validate = useCallback((field: keyof IntegrationNodeData, value: string) => {
      let error = '';
      const type = data.integrationType || 'mock';
      if (field === 'url' && type !== 'mock' && !isValidUrl(value)) error = 'Invalid URL';
      if (field === 'mockOutput' && type === 'mock' && !isValidJson(value)) error = 'Invalid JSON';
      setErrors(prev => { const newE = { ...prev }; if(error) newE[field]=error; else delete newE[field]; return newE; });
  }, [data.integrationType]);

  const handleChange = (field: keyof IntegrationNodeData, value: string | number) => {
      if (typeof value === 'string') validate(field, value);
      if (data.onFieldChange) data.onFieldChange(id, field, value);
      setTestStatus('idle');
  };
  const handleBlur = (field: keyof IntegrationNodeData, value: string) => { handleChange(field, value); };
  
  const handleTestConnection = async () => {
    if ((data.integrationType || 'mock') === 'mock' || !data.url) return;
    setTesting(true); setTestStatus('idle');
    try {
        const res = await fetch(data.url, { method: data.method || 'GET' });
        if (res.ok) setTestStatus('success'); else setTestStatus('error');
    } catch (e) { setTestStatus('error'); } finally { setTesting(false); setTimeout(() => setTestStatus('idle'), 3000); }
  };

  const isError = !!data.error;
  const isActive = !!data.active;
  const type = data.integrationType || 'mock';
  const styles = {
      mock: { color: 'blue', icon: FileJson, label: 'Mock Data' },
      rest: { color: 'indigo', icon: Globe, label: 'REST API' },
      graphql: { color: 'pink', icon: Code2, label: 'GraphQL' },
      calendar: { color: 'green', icon: Calendar, label: 'Calendar' }
  }[type];

  return (
    <div className={`w-80 rounded-2xl bg-white border shadow-node transition-all duration-300 hover:shadow-node-hover group ${isError ? 'border-red-400 ring-2 ring-red-100' : isActive ? 'border-yellow-400 ring-4 ring-yellow-200 shadow-glow-amber animate-pulse-glow' : `border-${styles.color}-200`}`}>
      
      {/* Header */}
      <div 
        className={`p-3 border-b flex items-center justify-between ${isCollapsed ? 'rounded-2xl border-b-0' : 'rounded-t-2xl'} ${isActive ? 'bg-gradient-to-r from-yellow-100 to-yellow-50' : `bg-gradient-to-r from-${styles.color}-50 to-white`} border-${styles.color}-100 cursor-pointer`}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-lg shadow-sm ${isActive ? 'bg-yellow-500 text-white' : `bg-white text-${styles.color}-600 border border-${styles.color}-100`}`}>
            <styles.icon size={16} />
          </div>
          <div>
            <div className={`font-bold text-slate-800 text-xs`}>{styles.label}</div>
            <div className={`text-[10px] text-${styles.color}-500 font-medium uppercase tracking-wider opacity-90`}>Data Source</div>
          </div>
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {isActive && !isError && <span className="text-[9px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold animate-pulse flex items-center gap-1"><Activity size={10}/> BUSY</span>}
            <button className={`${showDatabase ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-blue-500'} p-1.5 rounded-md transition-colors`} onClick={() => setShowDatabase(!showDatabase)}>
                <Database size={14} />
            </button>
            <button className={`text-slate-400 hover:text-${styles.color}-600 p-1.5 rounded-md transition-colors`} onClick={() => setIsCollapsed(!isCollapsed)}>
                {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
        </div>
      </div>

      {isError && <div className="bg-red-50 text-red-600 text-[10px] px-3 py-1 border-b border-red-100 flex items-center gap-1 font-medium"><AlertCircle size={10} /> {data.error}</div>}

      <Handle type="target" position={Position.Left} className={isActive ? '!bg-yellow-400' : `!bg-${styles.color}-400`} />
      <Handle type="source" position={Position.Right} className={isActive ? '!bg-yellow-400' : `!bg-${styles.color}-400`} />
      {showDatabase && data.databaseConfig && <DatabaseConfigPanel config={data.databaseConfig} onChange={(c) => data.onDatabaseChange && data.onDatabaseChange(id, c)} />}

      {!isCollapsed && (
          <div className="p-4 space-y-4 animate-fadeIn">
            {type === 'mock' && (
                <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Static JSON Response</label>
                    <textarea 
                        className={`nodrag w-full h-40 text-[10px] font-mono border rounded-lg p-2.5 text-slate-600 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none resize-none bg-slate-50 focus:bg-white ${errors.mockOutput ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                        placeholder='{"status": "success", ...}' value={localMockOutput} onChange={(e) => setLocalMockOutput(e.target.value)} onBlur={(e) => handleBlur('mockOutput', e.target.value)}
                    />
                </div>
            )}

            {type === 'calendar' && (
                <div className="space-y-3">
                    <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Calendar Provider</label>
                        <select className="nodrag w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:border-green-400 outline-none" value={(data as any).calendarProvider || 'google'} onChange={(e) => handleChange('calendarProvider' as any, e.target.value)}>
                            <option value="google">Google Calendar</option>
                            <option value="outlook">Microsoft Outlook</option>
                            <option value="apple">Apple Calendar</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Connection ID</label>
                        <input type="text" className="nodrag w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:border-green-400 outline-none" placeholder="calendar-connection-id" value={(data as any).connectionId || ''} onChange={(e) => handleChange('connectionId' as any, e.target.value)} />
                    </div>
                    <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Calendar ID</label>
                        <input type="text" className="nodrag w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:border-green-400 outline-none" placeholder="primary or calendar-id" value={(data as any).calendarId || ''} onChange={(e) => handleChange('calendarId' as any, e.target.value)} />
                    </div>
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-[10px] text-green-700">
                            Connect your calendar in workflow settings to use this integration.
                        </p>
                    </div>
                </div>
            )}

            {type !== 'mock' && type !== 'calendar' && (
                <div className="space-y-3">
                    <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Endpoint URL</label>
                        <div className="flex shadow-sm rounded-lg overflow-hidden">
                            {type === 'rest' && (
                                <select className="nodrag w-20 text-[10px] font-bold bg-slate-50 border border-slate-200 text-slate-700 border-r-0 focus:outline-none px-2" value={data.method || 'GET'} onChange={(e) => handleChange('method', e.target.value as any)}>
                                    <option>GET</option><option>POST</option><option>PUT</option><option>DEL</option>
                                </select>
                            )}
                            <input type="text" className={`nodrag flex-1 text-xs border px-3 py-2 text-slate-700 focus:ring-2 focus:ring-${styles.color}-100 focus:border-${styles.color}-400 outline-none font-mono ${type === 'rest' ? 'rounded-r-lg' : 'rounded-lg'} ${errors.url ? 'border-red-300 bg-red-50' : 'border-slate-200'}`}
                                placeholder="https://api..." value={localUrl} onChange={(e) => setLocalUrl(e.target.value)} onBlur={(e) => handleBlur('url', e.target.value)} />
                        </div>
                        {/* Test UI */}
                        <div className="flex justify-end mt-2">
                            <button onClick={handleTestConnection} disabled={testing || !data.url} className={`text-[9px] font-bold flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all ${testStatus === 'success' ? 'bg-green-100 text-green-700' : testStatus === 'error' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                                {testing ? <Zap size={10} className="animate-spin text-amber-500"/> : testStatus === 'success' ? <Check size={10}/> : testStatus === 'error' ? <X size={10}/> : <Play size={10}/>}
                                {testStatus === 'success' ? '200 OK' : testStatus === 'error' ? 'Failed' : 'Ping Endpoint'}
                            </button>
                        </div>
                    </div>

                    {/* Collapsible Auth */}
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <button onClick={() => setShowAuth(!showAuth)} className="w-full flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 transition-colors">
                            <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 uppercase"><Shield size={12} /> Authentication</div>
                            {showAuth ? <ChevronDown size={12} className="text-slate-400"/> : <ChevronRight size={12} className="text-slate-400"/>}
                        </button>
                        {showAuth && (
                            <div className="p-3 bg-white border-t border-slate-200 animate-fadeIn space-y-2">
                                <div>
                                    <label className="text-[9px] text-slate-400 font-bold uppercase mb-1 block">Type</label>
                                    <select className="nodrag w-full text-xs border border-slate-200 rounded px-2 py-1.5 focus:border-indigo-400 outline-none" value={data.authType || 'none'} onChange={(e) => handleChange('authType', e.target.value as any)}>
                                        <option value="none">None</option><option value="bearer">Bearer Token</option><option value="apiKey">API Key</option>
                                    </select>
                                </div>
                                {(data.authType === 'bearer' || data.authType === 'apiKey') && (
                                    <input type="password" className="nodrag w-full text-xs border border-slate-200 rounded px-2 py-1.5 bg-slate-50 focus:bg-white font-mono" placeholder="Secret / Token" value={data.authToken || ''} onChange={(e) => handleChange('authToken', e.target.value)} />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
          </div>
      )}
    </div>
  );
};

export default React.memo(IntegrationNode);
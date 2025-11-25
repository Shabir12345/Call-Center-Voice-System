import React, { useState } from 'react';
import { DatabaseConfig, KnowledgeItem, KeyValueItem } from '../../types';
import { Database, Plus, Trash2, Save, Server, Search, FileText, Settings, Key } from 'lucide-react';
import { HelpTip } from '../ui/HelpTip';

interface DatabaseConfigPanelProps {
  config: DatabaseConfig;
  onChange: (newConfig: DatabaseConfig) => void;
}

export const DatabaseConfigPanel: React.FC<DatabaseConfigPanelProps> = ({ config, onChange }) => {
  const [activeTab, setActiveTab] = useState<'knowledge' | 'kv' | 'settings'>('knowledge');

  const updateConfig = (field: keyof DatabaseConfig, value: any) => {
    onChange({ ...config, [field]: value });
  };

  // --- Knowledge Base Handlers ---
  const addKnowledge = () => {
    const newItem: KnowledgeItem = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'New Document',
      content: '',
      type: 'text'
    };
    updateConfig('knowledgeBase', [...config.knowledgeBase, newItem]);
  };

  const updateKnowledge = (id: string, field: keyof KnowledgeItem, value: string) => {
    const updated = config.knowledgeBase.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    );
    updateConfig('knowledgeBase', updated);
  };

  const removeKnowledge = (id: string) => {
    updateConfig('knowledgeBase', config.knowledgeBase.filter(item => item.id !== id));
  };

  // --- KV Handlers ---
  const addKV = () => {
    const newItem: KeyValueItem = {
      id: Math.random().toString(36).substr(2, 9),
      key: '',
      value: ''
    };
    updateConfig('staticData', [...config.staticData, newItem]);
  };

  const updateKV = (id: string, field: keyof KeyValueItem, value: string) => {
    const updated = config.staticData.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    );
    updateConfig('staticData', updated);
  };

  const removeKV = (id: string) => {
    updateConfig('staticData', config.staticData.filter(item => item.id !== id));
  };

  return (
    <div className="bg-slate-50 border-t border-slate-200 p-3 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 text-slate-800">
        <Database size={14} className="text-blue-600" />
        <span className="text-xs font-bold uppercase tracking-wide">Node Database</span>
        <div className="ml-auto flex bg-slate-200 rounded p-0.5">
            <button 
                onClick={() => setActiveTab('knowledge')}
                className={`px-2 py-0.5 text-[9px] font-bold rounded ${activeTab === 'knowledge' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
            >
                Knowledge
            </button>
            <button 
                onClick={() => setActiveTab('kv')}
                className={`px-2 py-0.5 text-[9px] font-bold rounded ${activeTab === 'kv' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
            >
                KV Store
            </button>
            <button 
                onClick={() => setActiveTab('settings')}
                className={`px-2 py-0.5 text-[9px] font-bold rounded ${activeTab === 'settings' ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}
            >
                Settings
            </button>
        </div>
      </div>

      {/* Tabs Content */}
      <div className="space-y-3">
        
        {/* KNOWLEDGE BASE TAB */}
        {activeTab === 'knowledge' && (
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center text-[10px] text-slate-500 uppercase font-semibold">
                        Documents (RAG)
                        <HelpTip content="Text chunks or docs this node can 'read' to answer questions." />
                    </label>
                    <button onClick={addKnowledge} className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-1">
                        <Plus size={10} /> Add Doc
                    </button>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                    {config.knowledgeBase.length === 0 && (
                        <div className="text-[10px] text-slate-400 italic text-center py-2 border border-dashed border-slate-200 rounded">
                            No documents yet.
                        </div>
                    )}
                    {config.knowledgeBase.map(item => (
                        <div key={item.id} className="bg-white border border-slate-200 rounded p-2 shadow-sm">
                            <div className="flex items-center gap-2 mb-1">
                                <FileText size={10} className="text-slate-400" />
                                <input 
                                    className="nodrag flex-1 text-[10px] font-bold text-slate-700 border-none p-0 focus:ring-0 placeholder-slate-300"
                                    placeholder="Doc Title"
                                    value={item.title}
                                    onChange={(e) => updateKnowledge(item.id, 'title', e.target.value)}
                                />
                                <button onClick={() => removeKnowledge(item.id)} className="text-slate-300 hover:text-red-500">
                                    <Trash2 size={10} />
                                </button>
                            </div>
                            <textarea 
                                className="nodrag w-full text-[10px] border border-slate-100 rounded p-1.5 text-slate-600 h-14 resize-none focus:outline-none focus:border-blue-400"
                                placeholder="Paste content here..."
                                value={item.content}
                                onChange={(e) => updateKnowledge(item.id, 'content', e.target.value)}
                            />
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* KV STORE TAB */}
        {activeTab === 'kv' && (
            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center text-[10px] text-slate-500 uppercase font-semibold">
                        Key-Value Pairs
                        <HelpTip content="Static configuration data available to the node." />
                    </label>
                    <button onClick={addKV} className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-1">
                        <Plus size={10} /> Add Row
                    </button>
                </div>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                     {config.staticData.length === 0 && (
                        <div className="text-[10px] text-slate-400 italic text-center py-2 border border-dashed border-slate-200 rounded">
                            No data entries.
                        </div>
                    )}
                    {config.staticData.map(item => (
                        <div key={item.id} className="flex gap-1 group">
                             <div className="relative flex-1">
                                <Key size={8} className="absolute left-1.5 top-2 text-slate-300" />
                                <input 
                                    className="nodrag w-full text-[10px] font-mono border border-slate-200 rounded pl-5 pr-1 py-1 focus:border-blue-400 outline-none"
                                    placeholder="Key"
                                    value={item.key}
                                    onChange={(e) => updateKV(item.id, 'key', e.target.value)}
                                />
                             </div>
                             <input 
                                className="nodrag w-full flex-1 text-[10px] border border-slate-200 rounded px-2 py-1 focus:border-blue-400 outline-none"
                                placeholder="Value"
                                value={item.value}
                                onChange={(e) => updateKV(item.id, 'value', e.target.value)}
                            />
                             <button onClick={() => removeKV(item.id)} className="text-slate-300 hover:text-red-500 px-1">
                                <Trash2 size={10} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
            <div className="space-y-3">
                 {/* Memory Type */}
                 <div>
                    <label className="flex items-center text-[10px] text-slate-500 uppercase font-semibold mb-1">
                        Memory Persistence
                        <HelpTip content="How long should this node remember data?" />
                    </label>
                    <select 
                        className="nodrag w-full text-[10px] border border-slate-200 rounded px-2 py-1 bg-white"
                        value={config.memoryType}
                        onChange={(e) => updateConfig('memoryType', e.target.value)}
                    >
                        <option value="ephemeral">Ephemeral (Per Call)</option>
                        <option value="session">Session (Per User Chat)</option>
                        <option value="long_term">Long Term (Supabase)</option>
                    </select>
                 </div>

                 {/* Vector Settings */}
                 <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="flex items-center text-[10px] text-slate-500 uppercase font-semibold">
                            Vector Search
                            <HelpTip content="Adjust retrieval sensitivity for Knowledge Base." />
                        </label>
                        <Search size={10} className="text-slate-400" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                             <span className="text-[9px] text-slate-400 block mb-0.5">Top K Results</span>
                             <input 
                                type="number" 
                                className="nodrag w-full text-[10px] border border-slate-200 rounded px-2 py-1"
                                value={config.vectorSettings.topK}
                                onChange={(e) => updateConfig('vectorSettings', { ...config.vectorSettings, topK: parseInt(e.target.value) })}
                             />
                        </div>
                         <div>
                             <span className="text-[9px] text-slate-400 block mb-0.5">Similarity (0-1)</span>
                             <input 
                                type="number" 
                                step="0.1"
                                className="nodrag w-full text-[10px] border border-slate-200 rounded px-2 py-1"
                                value={config.vectorSettings.threshold}
                                onChange={(e) => updateConfig('vectorSettings', { ...config.vectorSettings, threshold: parseFloat(e.target.value) })}
                             />
                        </div>
                    </div>
                 </div>

                 {/* Supabase Config */}
                 <div className="pt-2 border-t border-slate-100">
                    <label className="flex items-center gap-1 text-[10px] text-green-600 font-bold uppercase mb-2">
                        <Server size={10} />
                        Supabase Connection
                        <HelpTip content="Future-proof config for connecting to Supabase Backend." />
                    </label>
                    <input 
                        className="nodrag w-full text-[10px] border border-slate-200 rounded px-2 py-1 mb-2 font-mono"
                        placeholder="Target Table Name"
                        value={config.supabaseConfig.tableName || ''}
                        onChange={(e) => updateConfig('supabaseConfig', { ...config.supabaseConfig, tableName: e.target.value })}
                    />
                    <input 
                        className="nodrag w-full text-[10px] border border-slate-200 rounded px-2 py-1 font-mono text-slate-500"
                        placeholder="RLS Policy Name (Optional)"
                        value={config.supabaseConfig.rlsPolicy || ''}
                        onChange={(e) => updateConfig('supabaseConfig', { ...config.supabaseConfig, rlsPolicy: e.target.value })}
                    />
                 </div>
            </div>
        )}

      </div>
    </div>
  );
};
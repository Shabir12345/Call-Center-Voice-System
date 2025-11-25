import React from 'react';
import WorkflowEditorWrapper from './components/WorkflowEditor';

const App: React.FC = () => {
  return (
    <div className="w-full h-screen bg-gray-50 flex flex-col overflow-hidden text-slate-800">
      {/* Top Bar - "The Command Center" */}
      <header className="h-14 bg-white/80 backdrop-blur-md border-b border-gray-200/60 flex items-center px-6 justify-between shrink-0 z-30 sticky top-0">
        <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-200">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
            </div>
            <div>
                <h1 className="font-bold text-slate-900 text-sm tracking-tight">AgentFlow</h1>
                <div className="text-[10px] text-slate-500 font-medium tracking-wide">Orchestrator</div>
            </div>
        </div>
        
        {/* Center Status - Minimalist Indicators */}
        <div className="hidden md:flex items-center gap-6 bg-gray-100/50 px-4 py-1.5 rounded-full border border-gray-200/50">
             <div className="flex items-center gap-2">
                 <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Project</span>
                 <span className="text-xs font-semibold text-slate-700">Hospitality Voice Bot</span>
             </div>
             <div className="h-3 w-px bg-gray-300"></div>
             <div className="flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></span>
                 <span className="text-xs font-semibold text-slate-700">Ready</span>
             </div>
        </div>

        <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
                <div className="text-xs font-bold text-slate-700">Admin User</div>
                <div className="text-[10px] text-slate-400">Workspace Owner</div>
            </div>
            <div className="w-8 h-8 bg-gradient-to-tr from-slate-100 to-slate-200 rounded-full flex items-center justify-center text-xs font-bold text-slate-600 border border-slate-200 shadow-sm">
                AD
            </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden flex">
        <WorkflowEditorWrapper />
      </main>
    </div>
  );
};

export default App;
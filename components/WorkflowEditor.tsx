
import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  Connection,
  BackgroundVariant,
  Panel,
  useReactFlow,
  EdgeChange,
  MiniMap,
  ConnectionMode,
  MarkerType,
  Edge,
  ConnectionLineType,
  Position
} from 'reactflow';
import dagre from 'dagre';

import Sidebar from './Sidebar';
import TestPanel from './TestPanel';
import RouterNode from './nodes/RouterNode';
import DepartmentNode from './nodes/DepartmentNode';
import SubAgentNode from './nodes/SubAgentNode';
import IntegrationNode from './nodes/IntegrationNode';
import LogicNode from './nodes/LogicNode';
import NoteNode from './nodes/NoteNode';
import { ContextMenu } from './ui/ContextMenu';
import { NodeType, AppNode, RouterNodeData, DepartmentNodeData, SubAgentNodeData, IntegrationNodeData, NoteNodeData, LogicNodeData, AgentParameter, DatabaseConfig, VoiceSettings, ProjectMetadata } from '../types';
import { Save, Upload, Undo, Redo, Folder, Plus, ChevronDown, Check, Download, FileDown, Search, Wand2, Code, Share2, X, Play } from 'lucide-react';

const nodeTypes = {
  [NodeType.ROUTER]: RouterNode,
  [NodeType.DEPARTMENT]: DepartmentNode,
  [NodeType.SUB_AGENT]: SubAgentNode,
  [NodeType.INTEGRATION]: IntegrationNode,
  [NodeType.NOTE]: NoteNode,
  [NodeType.LOGIC]: LogicNode,
};

const PROJECTS_STORAGE_KEY = 'agentflow-projects-v1';

// Helpers
const createDefaultDbConfig = (): DatabaseConfig => ({ enabled: true, knowledgeBase: [], staticData: [], memoryType: 'session', vectorSettings: { topK: 3, threshold: 0.7 }, supabaseConfig: {} });
const createDefaultVoiceSettings = (): VoiceSettings => ({ speed: 1.0, interruptible: true, fillerWords: false });

const WorkflowEditor: React.FC = () => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { getNodes, getEdges, screenToFlowPosition, setViewport, fitView } = useReactFlow();
  
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [past, setPast] = useState<{nodes: AppNode[], edges: any[]}[]>([]);
  const [future, setFuture] = useState<{nodes: AppNode[], edges: any[]}[]>([]);
  
  // New UI Features State
  const [searchQuery, setSearchQuery] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // Context Menu State
  const [menu, setMenu] = useState<{ type: 'node' | 'edge'; id: string; top: number; left: number } | null>(null);

  const takeSnapshot = useCallback(() => {
      setPast((old) => [...old, { nodes: getNodes(), edges: getEdges() }]);
      setFuture([]);
  }, [getNodes, getEdges]);

  // --- Auto Layout (Dagre) ---
  const onLayout = useCallback(() => {
    takeSnapshot();
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: 'LR', nodesep: 80, ranksep: 120 });
    g.setDefaultEdgeLabel(() => ({}));

    nodes.forEach((node) => {
        g.setNode(node.id, { width: 320, height: 150 }); // Approx size
    });

    edges.forEach((edge) => {
        g.setEdge(edge.source, edge.target);
    });

    dagre.layout(g);

    const layoutedNodes = nodes.map((node) => {
        const nodeWithPosition = g.node(node.id);
        return {
            ...node,
            position: {
                x: nodeWithPosition.x - 160, // center offset
                y: nodeWithPosition.y - 75,
            },
        };
    });

    setNodes(layoutedNodes);
    setTimeout(() => fitView({ duration: 800 }), 100);
  }, [nodes, edges, setNodes, fitView, takeSnapshot]);

  // --- Search ---
  useEffect(() => {
    if (!searchQuery.trim()) {
        handleSetActiveNodes([]);
        return;
    }
    const matching = nodes.filter(n => 
        n.data.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.data as any).agentName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (n.data as any).text?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    handleSetActiveNodes(matching.map(n => n.id));
    
    // Pan to first match
    if (matching.length > 0) {
        const node = matching[0];
        setViewport({ x: -node.position.x + 300, y: -node.position.y + 300, zoom: 1 }, { duration: 500 });
    }
  }, [searchQuery]);

  const handleUndo = useCallback(() => {
      if (past.length === 0) return;
      const current = { nodes: getNodes(), edges: getEdges() };
      const previous = past[past.length - 1];
      const newPast = past.slice(0, past.length - 1);
      setPast(newPast);
      setFuture((old) => [current, ...old]);
      setNodes(previous.nodes);
      setEdges(previous.edges);
  }, [past, getNodes, getEdges, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
      if (future.length === 0) return;
      const current = { nodes: getNodes(), edges: getEdges() };
      const next = future[0];
      const newFuture = future.slice(1);
      setFuture(newFuture);
      setPast((old) => [...old, current]);
      setNodes(next.nodes);
      setEdges(next.edges);
  }, [future, getNodes, getEdges, setNodes, setEdges]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
            if (e.shiftKey) handleRedo(); else handleUndo();
            e.preventDefault();
        } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
            handleRedo(); e.preventDefault();
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const onConnect = useCallback((params: Connection) => {
      if (params.source === params.target) return;
      takeSnapshot(); 
      setEdges((eds) => addEdge({ 
          ...params, 
          animated: true, 
          type: 'default',
          style: { stroke: '#64748b', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#64748b' },
      }, eds)); 
  }, [setEdges, takeSnapshot]);

  const onDeleteNode = useCallback((id: string) => { takeSnapshot(); setNodes((nds) => nds.filter((node) => node.id !== id)); setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id)); }, [setNodes, setEdges, takeSnapshot]);
  const onEdgesChangeWrapped = useCallback((changes: EdgeChange[]) => { if (changes.some((c) => c.type === 'remove')) takeSnapshot(); onEdgesChange(changes); }, [onEdgesChange, takeSnapshot]);
  const onNodeDragStart = useCallback(() => { takeSnapshot(); }, [takeSnapshot]);
  const handleSetActiveNodes = useCallback((ids: string[]) => { setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, active: ids.includes(n.id) } }))); }, [setNodes]);

  const augmentNodeData = useCallback((node: AppNode): AppNode => {
    const baseHandlers = {
        onDelete: onDeleteNode,
        onDatabaseChange: (id: string, config: DatabaseConfig) => { setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, databaseConfig: config } } : n)); },
        onVoiceSettingsChange: (id: string, settings: VoiceSettings) => { setNodes((nds) => nds.map((n) => n.id === id ? { ...n, data: { ...n.data, voiceSettings: settings } } : n)); }
    };
    if (!node.data.databaseConfig) node.data.databaseConfig = createDefaultDbConfig();
    if (!node.data.voiceSettings && (node.type === NodeType.ROUTER || node.type === NodeType.SUB_AGENT)) node.data.voiceSettings = createDefaultVoiceSettings();

    const updateNode = (id: string, updater: (n: AppNode) => AppNode) => setNodes((nds) => nds.map((n) => n.id === id ? updater(n) : n));
    const updateEdges = (updater: (e: any) => any) => setEdges((eds) => eds.map(updater));

    if (node.type === NodeType.ROUTER) {
        return { ...node, data: { ...node.data, ...baseHandlers,
                onFieldChange: (id, f, v) => updateNode(id, n => ({ ...n, data: { ...n.data, [f]: v } })),
                onAddIntent: (id, i) => { takeSnapshot(); updateNode(id, n => ({ ...n, data: { ...n.data, intents: [...((n.data as RouterNodeData).intents || []), i] } })); },
                onRemoveIntent: (id, i) => { takeSnapshot(); updateNode(id, n => ({ ...n, data: { ...n.data, intents: ((n.data as RouterNodeData).intents || []).filter(item => item !== i) } })); },
                onEditIntent: (id, o, n) => { takeSnapshot(); updateNode(id, node => ({ ...node, data: { ...node.data, intents: ((node.data as RouterNodeData).intents || []).map(i => i === o ? n : i) } })); updateEdges(e => e.source === id && e.sourceHandle === `intent-${o}` ? { ...e, sourceHandle: `intent-${n}` } : e); }
        }};
    }
    if (node.type === NodeType.DEPARTMENT) {
        return { ...node, data: { ...node.data, ...baseHandlers,
                onFieldChange: (id, f, v) => updateNode(id, n => ({ ...n, data: { ...n.data, [f]: v } })),
                onAddTool: (id, t) => { takeSnapshot(); updateNode(id, n => ({ ...n, data: { ...n.data, tools: [...((n.data as DepartmentNodeData).tools || []), t] } })); },
                onRemoveTool: (id, t) => { takeSnapshot(); updateNode(id, n => ({ ...n, data: { ...n.data, tools: ((n.data as DepartmentNodeData).tools || []).filter(item => item !== t) } })); },
                onEditTool: (id, o, n) => { takeSnapshot(); updateNode(id, node => ({ ...node, data: { ...node.data, tools: ((node.data as DepartmentNodeData).tools || []).map(t => t === o ? n : t) } })); updateEdges(e => e.source === id && e.sourceHandle === `tool-${o}` ? { ...e, sourceHandle: `tool-${n}` } : e); }
        }};
    }
    if (node.type === NodeType.SUB_AGENT) {
        return { ...node, data: { ...node.data, ...baseHandlers,
                onFieldChange: (id, f, v) => updateNode(id, n => ({ ...n, data: { ...n.data, [f]: v } })),
                onParamsChange: (id, p) => updateNode(id, n => ({ ...n, data: { ...n.data, parameters: p } }))
        }};
    }
    if (node.type === NodeType.INTEGRATION) {
         return { ...node, data: { ...node.data, ...baseHandlers, onFieldChange: (id, f, v) => updateNode(id, n => ({ ...n, data: { ...n.data, [f]: v } })) }};
    }
    if (node.type === NodeType.LOGIC) {
        return { ...node, data: { ...node.data, ...baseHandlers, onLogicChange: (id, f, v) => updateNode(id, n => ({ ...n, data: { ...n.data, [f]: v } })) }};
    }
    if (node.type === NodeType.NOTE) {
        return { ...node, data: { ...node.data, ...baseHandlers,
             onTextChange: (id, t) => updateNode(id, n => ({ ...n, data: { ...n.data, text: t } })),
             onColorChange: (id, c) => { takeSnapshot(); updateNode(id, n => ({ ...n, data: { ...n.data, color: c } })); }
        }};
    }
    return node;
  }, [onDeleteNode, setNodes, takeSnapshot, setEdges]);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: AppNode) => {
      event.preventDefault();
      const pane = reactFlowWrapper.current?.getBoundingClientRect();
      if (pane) setMenu({ type: 'node', id: node.id, top: event.clientY - pane.top, left: event.clientX - pane.left });
    }, [setMenu]);

  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();
      const pane = reactFlowWrapper.current?.getBoundingClientRect();
      if (pane) setMenu({ type: 'edge', id: edge.id, top: event.clientY - pane.top, left: event.clientX - pane.left });
    }, [setMenu]);

  const onPaneClick = useCallback(() => setMenu(null), [setMenu]);
  
  const handleDuplicate = useCallback(() => {
      if (!menu || menu.type !== 'node') return;
      const node = nodes.find(n => n.id === menu.id);
      if (!node) return;
      takeSnapshot();
      const id = `${node.type}-${Date.now()}`;
      const newData = JSON.parse(JSON.stringify(node.data));
      delete newData.active; delete newData.error;
      const newNode: AppNode = { id, type: node.type, position: { x: node.position.x + 50, y: node.position.y + 50 }, data: newData };
      setNodes((nds) => nds.concat(augmentNodeData(newNode)));
      setMenu(null);
  }, [menu, nodes, setNodes, augmentNodeData, takeSnapshot]);

  const handleDelete = useCallback(() => {
      if (!menu) return;
      takeSnapshot();
      if (menu.type === 'node') onDeleteNode(menu.id); else setEdges((eds) => eds.filter((e) => e.id !== menu.id));
      setMenu(null);
  }, [menu, onDeleteNode, setEdges, takeSnapshot]);

  const handleConfigure = useCallback(() => {
      if (menu && menu.type === 'node') { handleSetActiveNodes([menu.id]); setMenu(null); }
  }, [menu, handleSetActiveNodes]);


  // Persistence & Templates
  const loadProject = (projectId: string) => {
      const stored = localStorage.getItem(PROJECTS_STORAGE_KEY);
      if (stored) {
          const parsed = JSON.parse(stored);
          const projectData = parsed[projectId];
          if (projectData && projectData.data) {
             setNodes(projectData.data.nodes.map((n: AppNode) => augmentNodeData(n)));
             const upgradedEdges = projectData.data.edges.map((e: Edge) => ({ ...e, type: 'default' }));
             setEdges(upgradedEdges);
             setCurrentProjectId(projectId);
          }
      }
  };
  const saveCurrentProject = () => {
      if (!currentProjectId) return;
      const stored = localStorage.getItem(PROJECTS_STORAGE_KEY);
      let parsed = stored ? JSON.parse(stored) : {};
      parsed[currentProjectId] = { ...parsed[currentProjectId], lastModified: Date.now(), data: { nodes, edges } };
      localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(parsed));
  };
  const createNewProject = () => {
      const id = Math.random().toString(36).substr(2, 9);
      const newProject: ProjectMetadata = { id, name: `Workflow ${projects.length + 1}`, lastModified: Date.now() };
       const defaultNodes: AppNode[] = [
        { id: '1', type: NodeType.ROUTER, position: { x: 350, y: 100 }, data: { label: 'Master Agent', agentName: 'Concierge', style: 'professional', voiceId: 'Zephyr', systemPrompt: 'You are a helpful concierge.', intents: ['Reservations'], databaseConfig: createDefaultDbConfig(), voiceSettings: createDefaultVoiceSettings() } as RouterNodeData },
        { id: '2', type: NodeType.DEPARTMENT, position: { x: 350, y: 450 }, data: { label: 'Sub Agent', agentName: 'Reservations Dept', description: 'Handles all room booking and availability requests.', systemPrompt: 'You are a reservations specialist.', tools: ['Availability'], databaseConfig: createDefaultDbConfig() } as DepartmentNodeData },
        { id: '3', type: NodeType.SUB_AGENT, position: { x: 700, y: 450 }, data: { label: 'Tool Agent', agentName: 'Room Checker', specialty: 'inventory', accessLevel: 'read_only', functionName: 'check_inventory', description: 'Checks DB for room availability', parameters: [{ id: 'p1', name: 'date', type: 'string', description: 'Date', required: true }], outputSchema: '{ "available": true }', databaseConfig: createDefaultDbConfig(), voiceSettings: createDefaultVoiceSettings() } as SubAgentNodeData }
    ];
    const defaultEdges = [{ id: 'e1-2', source: '1', target: '2', sourceHandle: 'intent-Reservations', animated: true, type: 'default', style: { stroke: '#cbd5e1', strokeWidth: 2 } }, { id: 'e2-3', source: '2', target: '3', sourceHandle: 'tool-Availability', animated: true, type: 'default', style: { stroke: '#cbd5e1', strokeWidth: 2 } }];
    const stored = localStorage.getItem(PROJECTS_STORAGE_KEY);
    let parsed = stored ? JSON.parse(stored) : {};
    parsed[id] = { ...newProject, data: { nodes: defaultNodes, edges: defaultEdges } };
    localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(parsed));
    setProjects(prev => [...prev, newProject]);
    setNodes(defaultNodes.map(n => augmentNodeData(n)));
    setEdges(defaultEdges);
    setCurrentProjectId(id);
    setShowProjectMenu(false);
  };

  const applyTemplate = (type: 'retail' | 'tech' | 'blank') => {
      takeSnapshot();
      let newNodes: AppNode[] = [];
      let newEdges: Edge[] = [];
      
      if (type === 'retail') {
          newNodes = [
              { id: 't1', type: NodeType.ROUTER, position: { x: 100, y: 100 }, data: { label: 'Master', agentName: 'Store Greeter', style: 'empathetic', systemPrompt: 'Greet customers, route returns or sales.', intents: ['Returns', 'Sales'], voiceSettings: createDefaultVoiceSettings() } as RouterNodeData },
              { id: 't2', type: NodeType.DEPARTMENT, position: { x: 100, y: 400 }, data: { label: 'Sales', agentName: 'Sales Rep', description: 'Handles purchases', systemPrompt: 'Help user buy items.', tools: ['Catalog'] } as DepartmentNodeData },
              { id: 't3', type: NodeType.DEPARTMENT, position: { x: 500, y: 400 }, data: { label: 'Returns', agentName: 'Returns Specialist', description: 'Handles refunds', systemPrompt: 'Process refunds.', tools: ['RefundAPI'] } as DepartmentNodeData },
              { id: 't4', type: NodeType.LOGIC, position: { x: 500, y: 700 }, data: { label: 'Condition', variableName: 'refund_amount', operator: 'less_than', value: '50' } as LogicNodeData },
          ];
          newEdges = [
              { id: 'te1', source: 't1', target: 't2', sourceHandle: 'intent-Sales', type: 'default' },
              { id: 'te2', source: 't1', target: 't3', sourceHandle: 'intent-Returns', type: 'default' },
              { id: 'te3', source: 't3', target: 't4', sourceHandle: 'tool-RefundAPI', type: 'default' }
          ];
      }
      // Add more templates as needed...
      
      setNodes(newNodes.map(n => augmentNodeData(n)));
      setEdges(newEdges);
      setShowTemplates(false);
      setTimeout(onLayout, 100);
  };

  const getExportCode = () => {
      return JSON.stringify({
          project: projects.find(p => p.id === currentProjectId)?.name,
          agents: nodes.filter(n => n.type === NodeType.ROUTER || n.type === NodeType.DEPARTMENT).map(n => ({
              id: n.id,
              name: n.data.agentName,
              prompt: (n.data as any).systemPrompt,
              tools: (n.data as any).tools || (n.data as any).intents
          })),
          integrations: nodes.filter(n => n.type === NodeType.INTEGRATION).map(n => ({
              id: n.id,
              url: (n.data as IntegrationNodeData).url
          }))
      }, null, 2);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        
        if (parsed.nodes && Array.isArray(parsed.nodes) && parsed.edges && Array.isArray(parsed.edges)) {
             takeSnapshot();
             // Re-hydrate nodes with handlers
             const hydratedNodes = parsed.nodes.map((n: AppNode) => augmentNodeData(n));
             setNodes(hydratedNodes);
             
             // Ensure edges have the correct type (new flexible curve style)
             const hydratedEdges = parsed.edges.map((e: Edge) => ({ ...e, type: 'default' }));
             setEdges(hydratedEdges);
             
             setTimeout(() => fitView({ duration: 800 }), 100);
        } else {
            alert("Invalid JSON structure. Expected { nodes: [], edges: [] }");
        }
      } catch (err) {
        console.error("Import failed", err);
        alert("Failed to import workflow.");
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again
    if (event.target) event.target.value = '';
  };

  useEffect(() => {
    const stored = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (stored) {
        const parsed = JSON.parse(stored);
        const list: ProjectMetadata[] = Object.keys(parsed).map(k => ({ id: parsed[k].id, name: parsed[k].name, lastModified: parsed[k].lastModified })).sort((a,b) => b.lastModified - a.lastModified);
        setProjects(list);
        if (list.length > 0) loadProject(list[0].id); else createNewProject();
    } else createNewProject();
  }, []);
  useEffect(() => { if (nodes.length > 0 && currentProjectId) saveCurrentProject(); }, [nodes, edges, currentProjectId]);

  const onDragOver = useCallback((event: React.DragEvent) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; }, []);
  const onDrop = useCallback((event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow') as NodeType;
      const subType = event.dataTransfer.getData('application/reactflow-subtype');
      if (!type) return;
      takeSnapshot();
      const position = reactFlowWrapper.current ? screenToFlowPosition({ x: event.clientX, y: event.clientY }) : { x: event.clientX, y: event.clientY };
      const id = `${type}-${Date.now()}`;
      let newNode: AppNode = { id, type, position, data: { label: 'New Node', databaseConfig: createDefaultDbConfig() } as any };
      if (type === NodeType.ROUTER) newNode.data = { ...newNode.data, label: 'Master Agent', agentName: 'New Master', voiceId: 'Zephyr', style: 'professional', systemPrompt: '', intents: [], voiceSettings: createDefaultVoiceSettings() } as RouterNodeData;
      else if (type === NodeType.DEPARTMENT) newNode.data = { ...newNode.data, label: 'Sub Agent', agentName: 'Specialist', description: '', systemPrompt: '', tools: [] } as DepartmentNodeData;
      else if (type === NodeType.SUB_AGENT) newNode.data = { ...newNode.data, label: 'Tool Agent', agentName: 'Tool Agent', specialty: 'general', accessLevel: 'read_only', datasource: '', functionName: 'tool_fn', parameters: [], outputSchema: '{}', voiceSettings: createDefaultVoiceSettings() } as SubAgentNodeData;
      else if (type === NodeType.INTEGRATION) newNode.data = { ...newNode.data, label: subType === 'rest' ? 'REST API' : subType === 'graphql' ? 'GraphQL' : 'Mock', integrationType: subType as any, mockOutput: '{"status": "ok"}', url: 'https://', method: 'GET', authType: 'none' } as IntegrationNodeData;
      else if (type === NodeType.LOGIC) newNode.data = { label: 'Condition', variableName: 'var', operator: 'equals', value: 'true' } as LogicNodeData;
      else if (type === NodeType.NOTE) newNode.data = { label: 'Note', text: '', color: '#fef3c7' } as NoteNodeData;
      setNodes((nds) => nds.concat(augmentNodeData(newNode)));
    }, [screenToFlowPosition, setNodes, takeSnapshot, augmentNodeData]);

  return (
    <div className="flex h-full w-full" ref={reactFlowWrapper}>
        <Sidebar />
        <div className="flex-1 relative h-full bg-slate-50/50">
            <ReactFlow
                nodes={nodes} 
                edges={edges} 
                onNodesChange={onNodesChange} 
                onEdgesChange={onEdgesChangeWrapped} 
                onConnect={onConnect} 
                onInit={setReactFlowInstance} 
                onDrop={onDrop} 
                onDragOver={onDragOver} 
                onNodeDragStart={onNodeDragStart} 
                nodeTypes={nodeTypes} 
                fitView 
                className="bg-slate-50/50"
                connectOnClick={false}
                connectionMode={ConnectionMode.Loose}
                defaultEdgeOptions={{ type: 'default', animated: true, style: { strokeWidth: 2, stroke: '#64748b' } }}
                connectionLineType={ConnectionLineType.Bezier}
                onNodeContextMenu={onNodeContextMenu}
                onEdgeContextMenu={onEdgeContextMenu}
                onPaneClick={onPaneClick}
            >
                <Controls showInteractive={false} className="shadow-lg border-none" />
                <MiniMap zoomable pannable className="shadow-lg rounded-xl border-2 border-white" nodeStrokeWidth={3} nodeColor="#cbd5e1" maskColor="rgba(241, 245, 249, 0.7)" />
                <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#cbd5e1" />
                
                {menu && (
                    <ContextMenu
                        top={menu.top}
                        left={menu.left}
                        type={menu.type}
                        id={menu.id}
                        onClose={() => setMenu(null)}
                        onDuplicate={handleDuplicate}
                        onConfigure={handleConfigure}
                        onDelete={handleDelete}
                    />
                )}

                {/* Hidden File Input for Import */}
                <input 
                    type="file"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                    accept=".json"
                    onChange={handleFileUpload}
                />

                {/* Top Control Bar */}
                <Panel position="top-right" className="flex flex-col gap-2 items-end">
                    <div className="bg-white/90 backdrop-blur-md p-1.5 rounded-xl shadow-lg border border-slate-200/60 flex gap-2">
                        {/* Search Bar */}
                        <div className="relative group border-r border-slate-200 pr-2 mr-1">
                             <div className="absolute left-2.5 top-2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                                 <Search size={14} />
                             </div>
                             <input 
                                className="pl-8 pr-3 py-1.5 bg-slate-100 focus:bg-white border border-transparent focus:border-indigo-200 rounded-lg text-xs font-medium w-32 focus:w-48 transition-all outline-none"
                                placeholder="Find node..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                             />
                        </div>

                        {/* Project Menu */}
                        <div className="relative border-r border-slate-200 pr-2 mr-1">
                            <button onClick={() => setShowProjectMenu(!showProjectMenu)} className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700 transition-colors">
                                <Folder size={14} className="text-indigo-500" />
                                {projects.find(p => p.id === currentProjectId)?.name || 'Project'}
                                <ChevronDown size={12} />
                            </button>
                            {showProjectMenu && (
                                <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 shadow-xl rounded-xl overflow-hidden z-50 flex flex-col animate-fadeIn">
                                    <button onClick={createNewProject} className="flex items-center gap-2 px-3 py-2.5 text-xs font-bold text-indigo-600 hover:bg-indigo-50 border-b border-slate-100 text-left">
                                        <Plus size={12} /> New Project
                                    </button>
                                    <div className="max-h-60 overflow-y-auto">
                                        {projects.map(p => (
                                            <button key={p.id} onClick={() => { loadProject(p.id); setShowProjectMenu(false); }} className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate-600 hover:bg-slate-50 text-left border-b border-slate-50 last:border-0">
                                                {p.name} {p.id === currentProjectId && <Check size={12} className="text-emerald-500" />}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* History Controls */}
                        <div className="flex items-center gap-1 pr-2 border-r border-slate-200">
                            <button onClick={handleUndo} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors" title="Undo"><Undo size={16}/></button>
                            <button onClick={handleRedo} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors" title="Redo"><Redo size={16}/></button>
                        </div>
                        
                        {/* New Feature Buttons */}
                        <div className="flex items-center gap-2 pl-1">
                             <button onClick={onLayout} className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors" title="Auto Layout">
                                <Share2 size={16} className="rotate-90"/>
                            </button>
                            <button onClick={() => fileInputRef.current?.click()} className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-colors" title="Import JSON">
                                <Upload size={16}/>
                            </button>
                            <button onClick={() => setShowTemplates(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-colors">
                                <Wand2 size={14} /> Templates
                            </button>
                             <button onClick={() => setShowExport(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg hover:bg-slate-700 transition-colors">
                                <Code size={14} /> Deploy
                            </button>
                        </div>
                    </div>
                </Panel>

                {/* Templates Modal */}
                {showTemplates && (
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center animate-fadeIn" onClick={() => setShowTemplates(false)}>
                        <div className="bg-white rounded-2xl shadow-2xl p-6 w-[500px]" onClick={e => e.stopPropagation()}>
                            <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Wand2 className="text-indigo-500"/> Choose a Template</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => applyTemplate('retail')} className="p-4 border border-slate-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left group">
                                    <div className="font-bold text-slate-700 group-hover:text-indigo-600 mb-1">Retail & Returns</div>
                                    <div className="text-xs text-slate-500">Sales rep + Returns handling with logic check.</div>
                                </button>
                                <button onClick={() => applyTemplate('tech')} className="p-4 border border-slate-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left group">
                                    <div className="font-bold text-slate-700 group-hover:text-indigo-600 mb-1">Tech Support</div>
                                    <div className="text-xs text-slate-500">Triage agent → Windows/Mac specialist routing.</div>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Export Modal */}
                {showExport && (
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center animate-fadeIn" onClick={() => setShowExport(false)}>
                         <div className="bg-white rounded-2xl shadow-2xl p-6 w-[600px] h-[400px] flex flex-col" onClick={e => e.stopPropagation()}>
                             <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Code className="text-emerald-500"/> Workflow Configuration</h3>
                                <button onClick={() => setShowExport(false)}><X size={20} className="text-slate-400 hover:text-slate-600"/></button>
                             </div>
                             <div className="flex-1 bg-slate-900 rounded-xl p-4 overflow-auto">
                                 <pre className="text-xs font-mono text-emerald-400">{getExportCode()}</pre>
                             </div>
                             <div className="mt-4 flex justify-end gap-2">
                                <button onClick={() => {
                                     const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({ nodes, edges }));
                                     const a = document.createElement('a'); a.href = dataStr; a.download = `flow_${currentProjectId}.json`; a.click();
                                }} className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold text-slate-700">
                                    <Download size={14}/> Download JSON
                                </button>
                                <button className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg text-xs font-bold text-white">
                                    <Play size={14}/> Deploy to Agent Runtime
                                </button>
                             </div>
                         </div>
                    </div>
                )}

            </ReactFlow>
        </div>
        <TestPanel nodes={nodes} edges={edges} setEdges={setEdges} onSetActiveNodes={handleSetActiveNodes} onSetNodeError={(id, err) => setNodes((nds) => nds.map(n => n.id === id ? { ...n, data: { ...n.data, error: err } } : n))} onClearNodeErrors={() => setNodes((nds) => nds.map(n => ({ ...n, data: { ...n.data, error: undefined } })))} />
    </div>
  );
};

const WorkflowEditorWrapper = () => ( <ReactFlowProvider><WorkflowEditor /></ReactFlowProvider> );
export default WorkflowEditorWrapper;

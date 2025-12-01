/**
 * TestPanel Component
 * 
 * Main component for testing and simulating the call center voice system.
 * Handles the communication flow between Master Agent, Sub-Agents (Departments), and Tool Agents.
 * 
 * Architecture:
 * - Master Agent (RouterNode): The only agent that speaks to callers. Uses tools to consult sub-agents.
 * - Sub-Agents (DepartmentNode): Backend logic advisors that process requests using their tools.
 * - Tool Agents (SubAgentNode): Direct execution units that connect to Integration Nodes.
 * 
 * Communication Flow:
 * 1. Master Agent receives caller input via voice
 * 2. Master Agent calls tools (either DEPARTMENT or SUB_AGENT nodes)
 * 3. For DEPARTMENT nodes: Creates separate Gemini chat session (runSubAgentLoop)
 * 4. For SUB_AGENT nodes: Direct execution (executeToolLogic)
 * 5. Responses are normalized and returned to Master Agent
 * 6. Master Agent communicates response to caller
 * 
 * Features:
 * - Hybrid architecture: Session-based for complex logic, direct calls for simple tools
 * - Comprehensive error handling with retry logic
 * - Timeout protection for all operations
 * - Response validation and normalization
 * - Detailed logging for debugging
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense, lazy } from 'react';
import { CallLogs, LogEntry as CallLogEntry } from './ui/CallLogs';
import { VoiceControls } from './ui/VoiceControls';
import { MetricsDisplay } from './ui/MetricsDisplay';
import { Phone, Mic, Square, Play, Pause, Volume2, Activity, MessageSquare, AlertTriangle, Clock, Download, Coins, Zap, CheckCircle2, Target, ShieldAlert, ChevronDown, ChevronRight, ArrowRightLeft, Network, Bot, User, Type, Brain, FileJson } from 'lucide-react';
import { GeminiClient, ToolCallResponse } from '../utils/geminiClient';
import { AppNode, Edge, NodeType, RouterNodeData, SubAgentNodeData, IntegrationNodeData, DepartmentNodeData, CommunicationConfig, AgentMessage, ConversationContext } from '../types';
import { GoogleGenAI, Chat, GenerateContentResponse, Part } from "@google/genai";
import { validateSubAgentResponse, normalizeSubAgentResponse, transformResponseForMaster, withTimeout, withRetry, isRetryableError } from '../utils/responseValidator';
import { ErrorCode, createErrorResponse } from '../utils/errorHandling';
import { CommunicationManager } from '../utils/agentCommunication';
import { CommunicationMonitor } from '../utils/communicationMonitor';
import { createMessage } from '../utils/communicationProtocols';
import { PerformanceMonitor } from '../utils/performanceMonitor';
import { HealthChecker } from '../utils/healthChecker';
import { AnalyticsManager } from '../utils/analytics';
import { Tracer } from '../utils/tracing';
import { ReliabilityMetricsTracker } from '../utils/reliabilityMetrics';
import { CentralLogger } from '../utils/logger';
import { StateManager } from '../utils/stateManager';
import { SessionManager } from '../utils/sessionManager';
import { AlertManager } from '../utils/alerting';
import { DashboardProvider } from '../utils/dashboard';
// Lazy load heavy observability components for better initial bundle size
const ObservabilityPanel = lazy(() => import('./ObservabilityPanel'));
const SystemStatusPanel = lazy(() => import('./SystemStatusPanel'));
const SessionMemoryPanel = lazy(() => import('./SessionMemoryPanel'));
import { TestPanelAdapter } from '../utils/testPanelAdapter';
import { ToolExecutor } from '../utils/toolExecutor';
import { ConfigValidator } from '../utils/configValidator';
import { initializeSecurity } from '../utils/securityHeaders';
import { globalAuditLogger } from '../utils/auditLogger';
import { AnomalyDetector } from '../utils/anomalyDetection';
import { CircuitBreaker, CircuitState } from '../utils/circuitBreaker';
import { RateLimiter, RateLimitConfig } from '../utils/rateLimiter';
import { DegradationManager, DegradationLevel, getDegradationManager } from '../utils/degradationManager';

interface TestPanelProps {
  nodes: AppNode[];
  edges: Edge[];
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onSetActiveNodes: (nodeIds: string[]) => void;
  onUpdateNodeUsage?: (nodeId: string) => void; // Callback to update usage count
  onSetNodeError: (nodeId: string, error: string) => void;
  onClearNodeErrors: () => void;
}

interface LogEntry {
    id: string;
    role: 'user' | 'agent' | 'system' | 'debug';
    text: string;
    details?: any; // For structured debug data
    timestamp: Date;
}

const HUMAN_PROMPT = `
VOICE STYLE GUIDELINES:
1.  **Sound Natural**: Do not sound like a robot.
2.  **Pacing**: Vary your speaking speed.
3.  **Filler Words**: Naturally use filler words (like "um", "uh") to simulate thinking.
4.  **Intonation**: Use pitch changes to express empathy or curiosity.
5.  **Brevity**: Speak in concise, conversational bursts.
6.  **Sole Speaker**: You are the ONLY agent the user speaks to. You must never transfer the user. You consult your tools silently and then relay the answer.
`;

// Default communication configuration
const DEFAULT_COMM_CONFIG: CommunicationConfig = {
  timeout: {
    subAgentLoop: 30000, // 30 seconds
    toolExecution: 10000  // 10 seconds
  },
  retry: {
    enabled: true,
    maxRetries: 2,
    initialDelay: 1000,
    maxDelay: 5000
  },
  logging: {
    enabled: true,
    level: 'debug'
  }
};

const DebugLogItem: React.FC<{ log: LogEntry }> = ({ log }) => {
  const [expanded, setExpanded] = useState(false);
  
  // Determine icon and color based on log content
  const getLogIcon = () => {
    const text = log.text.toLowerCase();
    if (text.includes('mock data') || text.includes('mock integration')) {
      return { icon: FileJson, color: 'text-purple-500', bg: 'bg-purple-50 border-purple-200' };
    }
    if (text.includes('tool result') || text.includes('tool execution')) {
      return { icon: Zap, color: 'text-yellow-500', bg: 'bg-yellow-50 border-yellow-200' };
    }
    if (text.includes('normalized') || text.includes('normalization')) {
      return { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50 border-green-200' };
    }
    if (text.includes('error') || text.includes('failed')) {
      return { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-50 border-red-200' };
    }
    if (text.includes('sub-agent') || text.includes('department')) {
      return { icon: Bot, color: 'text-cyan-500', bg: 'bg-cyan-50 border-cyan-200' };
    }
    return { icon: Network, color: 'text-slate-500', bg: 'bg-slate-100 border-slate-200' };
  };
  
  const { icon: Icon, color, bg } = getLogIcon();
  
  // Extract key information from details for preview
  const getPreviewInfo = () => {
    if (!log.details) return null;
    const details = log.details as any;
    if (details.dataStructure) return `Structure: ${details.dataStructure}`;
    if (details.summary) return `Summary: ${details.summary.substring(0, 50)}...`;
    if (details.dataKeys && Array.isArray(details.dataKeys)) return `Fields: ${details.dataKeys.join(', ')}`;
    if (details.success !== undefined) return `Success: ${details.success}`;
    if (details.hasData !== undefined) return `Has Data: ${details.hasData}`;
    return null;
  };
  
  const previewInfo = getPreviewInfo();
  
  return (
      <div className="flex flex-col my-1 animate-fadeIn max-w-[90%] self-center w-full">
           <div 
              className={`flex items-center gap-2 px-3 py-1.5 ${bg} border rounded-md cursor-pointer hover:opacity-80 transition-all`}
              onClick={() => setExpanded(!expanded)}
           >
               {expanded ? <ChevronDown size={12} className={color}/> : <ChevronRight size={12} className={color}/>}
               <Icon size={12} className={color} />
               <div className="flex-1 min-w-0">
                   <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide block truncate">{log.text}</span>
                   {previewInfo && !expanded && (
                       <span className="text-[9px] text-slate-500 italic truncate block mt-0.5">{previewInfo}</span>
                   )}
               </div>
               <span className="text-[9px] text-slate-400 font-mono">DEBUG</span>
           </div>
           {expanded && log.details && (
               <div className="mt-1 ml-4 p-3 bg-slate-800 rounded-md text-slate-300 font-mono text-[10px] overflow-x-auto border border-slate-700 shadow-inner">
                   <div className="mb-2 text-slate-400 text-[9px] uppercase tracking-wide">Details</div>
                   <pre className="whitespace-pre-wrap break-words">{JSON.stringify(log.details, null, 2)}</pre>
               </div>
           )}
      </div>
  );
};

const TestPanel: React.FC<TestPanelProps> = ({ nodes, edges, setEdges, onSetActiveNodes, onUpdateNodeUsage, onSetNodeError, onClearNodeErrors }) => {
  const [isCallActive, setIsCallActive] = useState(false);
  const [activeAgentId, setActiveAgentId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [liveTranscript, setLiveTranscript] = useState<{user: string, model: string}>({ user: '', model: '' });
  const [apiKeyError, setApiKeyError] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(0);
  const [metrics, setMetrics] = useState({
      totalInteractions: 0,
      successfulResolutions: 0,
      isSessionResolved: false
  });
  // Simple architecture stats so users can SEE the multi-agent system - memoized for performance
  const departmentCount = useMemo(() => 
    nodes.filter(n => n.type === NodeType.DEPARTMENT).length, 
    [nodes]
  );
  const toolCount = useMemo(() => 
    nodes.filter(n => n.type === NodeType.SUB_AGENT).length, 
    [nodes]
  );
  
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const durationIntervalRef = useRef<any>(null);
  const conversationHistoryRef = useRef<string>(""); 
  const transcriptBufferRef = useRef<{user: string, model: string}>({ user: '', model: '' });
  const activeSpeakerRef = useRef<'user' | 'model' | null>(null);

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
    // Update ToolExecutor when nodes/edges change
    if (toolExecutorRef.current) {
      toolExecutorRef.current.updateNodesAndEdges(nodes, edges);
    }
  }, [nodes, edges]);

  const geminiRef = useRef<GeminiClient | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>(0);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Bidirectional Communication System
  const commManagerRef = useRef<CommunicationManager | null>(null);
  const commMonitorRef = useRef<CommunicationMonitor | null>(null);
  
  // Observability Tools
  const loggerRef = useRef<CentralLogger | null>(null);
  const performanceMonitorRef = useRef<PerformanceMonitor | null>(null);
  const healthCheckerRef = useRef<HealthChecker | null>(null);
  const analyticsManagerRef = useRef<AnalyticsManager | null>(null);
  const tracerRef = useRef<Tracer | null>(null);
  const reliabilityTrackerRef = useRef<ReliabilityMetricsTracker | null>(null);
  const anomalyDetectorRef = useRef<AnomalyDetector | null>(null);
  const stateManagerRef = useRef<StateManager | null>(null);
  const sessionManagerRef = useRef<SessionManager | null>(null);
  const alertManagerRef = useRef<AlertManager | null>(null);
  const dashboardProviderRef = useRef<DashboardProvider | null>(null);
  const [showObservability, setShowObservability] = useState(false);
  const [showSessionMemory, setShowSessionMemory] = useState(false);
  const [simulationMode, setSimulationMode] = useState<'voice' | 'text'>('voice');
  const [selectedAppVariant, setSelectedAppVariant] = useState<string>('');
  const [textInput, setTextInput] = useState('');
  const [textSessionId] = useState(() => `text_session_${Date.now()}`);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const testPanelAdapterRef = useRef<TestPanelAdapter | null>(null);
  const toolExecutorRef = useRef<ToolExecutor | null>(null);

  // Resilience features (Phase 2)
  const circuitBreakerRef = useRef<CircuitBreaker | null>(null);
  const rateLimiterRef = useRef<RateLimiter | null>(null);
  const degradationManagerRef = useRef<DegradationManager | null>(null);
  const [resilienceStatus, setResilienceStatus] = useState<{
    circuitBreaker: { state: string; stats?: any } | null;
    rateLimit: { allowed: boolean; remaining: number; retryAfter?: number } | null;
    degradation: DegradationLevel | null;
  } | null>(null);
  
  // Initialize TestPanelAdapter for text mode
  useEffect(() => {
    if (!testPanelAdapterRef.current) {
      testPanelAdapterRef.current = new TestPanelAdapter();
    }
    
    // Initialize adapter with current nodes when nodes change
    const masterNodeId = nodes.find(n => n.type === NodeType.ROUTER)?.id || null;
    const callbacks = {
      onSystemMessage: (message: string) => {
        addLog('system', message);
      },
      onAgentActive: (agentId: string) => {
        if (masterNodeId) {
          // Track usage for master agent and sub-agent
          if (onUpdateNodeUsage) {
            onUpdateNodeUsage(masterNodeId);
            onUpdateNodeUsage(agentId);
          }
          onSetActiveNodes([masterNodeId, agentId]);
          // Reset after a delay
          setTimeout(() => {
            if (masterNodeId) {
              onSetActiveNodes([masterNodeId]);
            }
          }, 2000);
        }
      },
      onEdgeAnimate: (source: string, target: string) => {
        animateEdges([{ source, target }]);
      }
    };
    
    if (nodes.length > 0 && selectedAppVariant) {
      testPanelAdapterRef.current.initializeFromNodes(nodes, selectedAppVariant, callbacks).catch(err => {
        console.error('Failed to initialize TestPanelAdapter:', err);
        addLog('system', `❌ Failed to initialize text mode: ${err.message}`);
      });
    } else if (nodes.length > 0 && simulationMode === 'text') {
      // Initialize without app variant
      testPanelAdapterRef.current.initializeFromNodes(nodes, undefined, callbacks).catch(err => {
        console.error('Failed to initialize TestPanelAdapter:', err);
        addLog('system', `❌ Failed to initialize text mode: ${err.message}`);
      });
    }
  }, [nodes, selectedAppVariant, simulationMode, activeAgentId]);

  // Initialize communication system and observability tools
  useEffect(() => {
    // Initialize logger
    if (!loggerRef.current) {
      loggerRef.current = new CentralLogger('info');
    }
    
    // Initialize state manager
    if (!stateManagerRef.current) {
      stateManagerRef.current = new StateManager();
    }
    
    // Initialize performance monitor
    if (!performanceMonitorRef.current && loggerRef.current) {
      performanceMonitorRef.current = new PerformanceMonitor(loggerRef.current);
    }
    
    // Initialize analytics manager
    if (!analyticsManagerRef.current && loggerRef.current && performanceMonitorRef.current) {
      analyticsManagerRef.current = new AnalyticsManager(loggerRef.current, performanceMonitorRef.current);
    }
    
    // Initialize reliability tracker
    if (!reliabilityTrackerRef.current && loggerRef.current) {
      reliabilityTrackerRef.current = new ReliabilityMetricsTracker(loggerRef.current);
    }
    
    // Initialize anomaly detector
    if (!anomalyDetectorRef.current && 
        loggerRef.current && 
        performanceMonitorRef.current && 
        analyticsManagerRef.current) {
      anomalyDetectorRef.current = new AnomalyDetector(
        performanceMonitorRef.current,
        analyticsManagerRef.current,
        loggerRef.current,
        { enabled: true, checkInterval: 60000 }
      );
    }
    
    // Initialize tracer
    if (!tracerRef.current && loggerRef.current) {
      tracerRef.current = new Tracer(loggerRef.current);
    }
    
    // Initialize ToolExecutor for shared tool execution (Phase 1.3 migration)
    if (!toolExecutorRef.current && loggerRef.current && tracerRef.current) {
      toolExecutorRef.current = new ToolExecutor(
        nodesRef.current,
        edgesRef.current,
        {
          timeout: DEFAULT_COMM_CONFIG.timeout.toolExecution,
          retry: DEFAULT_COMM_CONFIG.retry,
          logger: loggerRef.current,
          tracer: tracerRef.current,
          onSetActiveNodes: onSetActiveNodes,
          onSetNodeError: onSetNodeError,
          onUpdateNodeUsage: onUpdateNodeUsage,
          onLog: (level, text, details) => {
            addLog(level === 'system' ? 'system' : 'debug', text, details);
          }
        }
      );
    }
    
    // Update ToolExecutor when nodes/edges change
    if (toolExecutorRef.current) {
      toolExecutorRef.current.updateNodesAndEdges(nodesRef.current, edgesRef.current);
    }
    
    if (!commManagerRef.current) {
      commManagerRef.current = new CommunicationManager({
        enabled: true,
        maxConversationDepth: 5,
        timeout: 30000,
        retryEnabled: true,
        maxRetries: 2
      });
    }
    
    if (!commMonitorRef.current) {
      commMonitorRef.current = new CommunicationMonitor();
      
      // Subscribe to communication events for monitoring
      commManagerRef.current.onEvent('*', (event) => {
        commMonitorRef.current?.log(event);
        // Also track in analytics
        analyticsManagerRef.current?.trackEvent('communication', {
          type: event.type,
          from: event.from,
          to: event.to
        });
      });
    }
    
    // Initialize health checker
    if (!healthCheckerRef.current && 
        commManagerRef.current && 
        stateManagerRef.current && 
        loggerRef.current && 
        performanceMonitorRef.current) {
      healthCheckerRef.current = new HealthChecker(
        commManagerRef.current,
        stateManagerRef.current,
        loggerRef.current,
        performanceMonitorRef.current
      );
    }

    // Initialize session manager
    if (!sessionManagerRef.current && stateManagerRef.current && loggerRef.current) {
      sessionManagerRef.current = new SessionManager(stateManagerRef.current, loggerRef.current);
    }

    // Initialize alert manager
    if (!alertManagerRef.current && 
        loggerRef.current && 
        performanceMonitorRef.current && 
        healthCheckerRef.current) {
      alertManagerRef.current = new AlertManager(
        loggerRef.current,
        performanceMonitorRef.current,
        healthCheckerRef.current
      );
    }

    // Initialize dashboard provider (unified interface for all observability data)
    if (!dashboardProviderRef.current && 
        performanceMonitorRef.current && 
        healthCheckerRef.current && 
        analyticsManagerRef.current && 
        sessionManagerRef.current && 
        alertManagerRef.current && 
        loggerRef.current) {
      dashboardProviderRef.current = new DashboardProvider(
        performanceMonitorRef.current,
        healthCheckerRef.current,
        analyticsManagerRef.current,
        sessionManagerRef.current,
        alertManagerRef.current,
        loggerRef.current,
        reliabilityTrackerRef.current || undefined,
        anomalyDetectorRef.current || undefined
      );
    }

    // Initialize resilience features (Phase 2)
    if (!circuitBreakerRef.current && loggerRef.current) {
      circuitBreakerRef.current = new CircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 60000,
        enablePersistence: true,
        persistenceKey: 'gemini_circuit_breaker',
        onStateChange: (state) => {
          if (loggerRef.current) {
            loggerRef.current.info(`Circuit breaker state changed: ${state}`, { serviceName: 'gemini_api' });
          }
          updateResilienceStatus();
        },
        onMetric: (metric) => {
          // Track metrics for monitoring
        }
      }, 'gemini_api');
    }

    if (!rateLimiterRef.current) {
      rateLimiterRef.current = new RateLimiter({
        maxRequests: 60,      // 60 requests
        windowMs: 60000,      // per minute
        burstSize: 10         // allow 10 extra as burst
      });
    }

    if (!degradationManagerRef.current && loggerRef.current) {
      degradationManagerRef.current = getDegradationManager({
        logger: loggerRef.current,
        onLevelChange: (level, reason) => {
          if (loggerRef.current) {
            loggerRef.current.warn(`Degradation level changed to ${DegradationLevel[level]}`, {
              component: reason.component,
              reason: reason.reason
            });
          }
          updateResilienceStatus();
        },
        enableAutoRecovery: true,
        recoveryCheckInterval: 30000
      });
    }

    // Update resilience status periodically
    const statusInterval = setInterval(() => {
      updateResilienceStatus();
    }, 5000); // Update every 5 seconds

    return () => {
      // Cleanup on unmount
      if (commManagerRef.current) {
        commManagerRef.current.clear();
      }
      clearInterval(statusInterval);
      if (degradationManagerRef.current) {
        degradationManagerRef.current.shutdown();
      }
    };
  }, []);

  // Update resilience status
  const updateResilienceStatus = useCallback(() => {
    setResilienceStatus({
      circuitBreaker: circuitBreakerRef.current ? {
        state: circuitBreakerRef.current.getState(),
        stats: circuitBreakerRef.current.getStats()
      } : null,
      rateLimit: geminiRef.current ? geminiRef.current.getRateLimitStatus() : null,
      degradation: degradationManagerRef.current ? degradationManagerRef.current.getLevel() : null
    });
  }, []);

  useEffect(() => {
      // Validate configuration at startup
      const validator = new ConfigValidator();
      const isValid = validator.validateStartup();
      
      if (!isValid) {
          console.error('❌ Configuration validation failed - some features may not work');
      }

      // Check API key (will be removed once backend is implemented)
      if (!process.env.API_KEY) {
          setApiKeyError(true);
      }

      // Initialize security
      initializeSecurity();

      // Initialize audit logging
      globalAuditLogger.log({
        eventType: 'session_creation',
        action: 'application_startup',
        result: 'success',
        details: { timestamp: Date.now() }
      });
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, liveTranscript]);

  const addLog = (role: 'user' | 'agent' | 'system' | 'debug', text: string, details?: any) => {
    if (!text || text.trim() === '') return;
    if (role === 'user' || role === 'agent') {
        const prefix = role === 'user' ? "User" : "AI";
        conversationHistoryRef.current += `\n${prefix}: ${text}`;
    }
    setLogs(prev => [...prev, {
        id: Math.random().toString(36).substring(7),
        role,
        text: text.trim(),
        details,
        timestamp: new Date()
    }]);
  };

  // formatDuration removed - now handled by MetricsDisplay component

  // Add natural thinking delay (2-5 seconds)
  const addNaturalDelay = () => {
    const delay = Math.random() * 3000 + 2000; // 2-5 seconds
    return new Promise(resolve => setTimeout(resolve, delay));
  };
  
  const animateEdges = (connections: { source: string, target: string }[]) => {
      setEdges((eds) => eds.map(e => {
          if (connections.some(c => c.source === e.source && c.target === e.target)) {
              return { ...e, animated: true, style: { stroke: '#f59e0b', strokeWidth: 3 } };
          }
          return { ...e, style: { stroke: '#cbd5e1', strokeWidth: 1.5 } };
      }));
      setTimeout(() => {
          setEdges((eds) => eds.map(e => ({ ...e, animated: true, style: { stroke: '#cbd5e1', strokeWidth: 1.5 } })));
      }, 3000);
  };

  /**
   * Generates unique tool names based on Node ID to prevent "Duplicate function declaration" errors
   * Also provides fallback matching by node ID
   * @param node - The node to generate a tool name for
   * @returns Unique tool name or null if node type doesn't support tools
   */
  const getToolName = useCallback((node: AppNode): string | null => {
      if (!node) return null;
      
      const cleanId = node.id.replace(/[^a-zA-Z0-9]/g, '');
      
      if (node.type === NodeType.SUB_AGENT) {
          const data = node.data as SubAgentNodeData;
          const base = data.functionName || data.agentName || `consult_${data.specialty?.toLowerCase() || 'tool'}`;
          return `${base.replace(/[^a-zA-Z0-9_]/g, '_')}_${cleanId}`;
      }
      
      if (node.type === NodeType.DEPARTMENT) {
          const data = node.data as DepartmentNodeData;
          const base = data.agentName || 'department';
          return `consult_${base.replace(/[^a-zA-Z0-9_]/g, '_')}_${cleanId}`;
      }
      
      return null;
  }, []);

  /**
   * Validates that a tool connection exists and is properly configured
   * @param nodeId - ID of the node to validate
   * @param toolName - Name of the tool to validate
   * @returns Validation result with error details if invalid
   */
  const validateToolConnection = useCallback((nodeId: string, toolName: string): { valid: boolean; error?: string } => {
      const node = nodesRef.current.find(n => n.id === nodeId);
      
      if (!node) {
          return { valid: false, error: `Node ${nodeId} not found` };
      }
      
      // Check if node type supports tools
      if (node.type !== NodeType.SUB_AGENT && node.type !== NodeType.DEPARTMENT) {
          return { valid: false, error: `Node type ${node.type} does not support tools` };
      }
      
      // Check if tool name matches
      const expectedName = getToolName(node);
      if (expectedName !== toolName) {
          // This is a warning, not an error - tool names might have slight variations
          addLog('debug', 'Tool name mismatch', {
              nodeId,
              expected: expectedName,
              received: toolName
          });
      }
      
      // Check if node has required configuration
      if (node.type === NodeType.SUB_AGENT) {
          const data = node.data as SubAgentNodeData;
          if (!data.specialty && !data.agentName && !data.functionName) {
              return { valid: false, error: 'Sub-agent node missing required configuration (specialty, agentName, or functionName)' };
          }
      }
      
      if (node.type === NodeType.DEPARTMENT) {
          const data = node.data as DepartmentNodeData;
          if (!data.agentName) {
              return { valid: false, error: 'Department node missing agentName' };
          }
      }
      
      return { valid: true };
  }, [getToolName]);

   const generateToolsForAgent = (agentNodeId: string) => {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    const tools: any[] = [];
    const connectedEdges = currentEdges.filter(e => e.source === agentNodeId);
    const processedTargets = new Set<string>(); // Deduplication Tracker
    
    connectedEdges.forEach(edge => {
        const targetNode = currentNodes.find(n => n.id === edge.target);
        if (!targetNode) return;
        
        // Prevent adding the same node as a tool twice (duplicate edge protection)
        if (processedTargets.has(targetNode.id)) return;
        processedTargets.add(targetNode.id);
        
        const toolName = getToolName(targetNode);
        if (!toolName) return;

        if (targetNode.type === NodeType.SUB_AGENT) {
            const data = targetNode.data as SubAgentNodeData;
            let description = data.description || `USE THIS TOOL to fetch information about ${data.specialty}.`;
            description += " You must answer the user yourself after getting the data.";
            const integrationEdge = currentEdges.find(e => e.source === targetNode.id && currentNodes.find(n => n.id === e.target && n.type === NodeType.INTEGRATION));
            const connectedIntegration = integrationEdge ? currentNodes.find(n => n.id === integrationEdge.target) : null;
            if (connectedIntegration) {
                const intData = connectedIntegration.data as IntegrationNodeData;
                if (intData.aiInstructions) description += ` Data Source: ${intData.aiInstructions}.`;
                
                // Add response format information for mock data
                if (intData.integrationType === 'mock' && intData.mockOutput) {
                    try {
                        const mockData = JSON.parse(intData.mockOutput);
                        if (typeof mockData === 'object' && mockData !== null) {
                            const keys = Object.keys(mockData);
                            if (keys.length > 0) {
                                description += ` The tool will return data with fields: ${keys.join(', ')}. Read ALL fields from the response.data object.`;
                            }
                        }
                    } catch (e) {
                        // Ignore parse errors in description generation
                    }
                }
            }
            
            // Add explicit response format instruction
            description += " IMPORTANT: The tool response will have a 'result' object with 'data', 'summary', and 'structure' fields. Read the 'data' field to get all information.";
            const properties: Record<string, any> = {
                // query: { type: "STRING", description: "The specific information or query needed." },
                // payload: { type: "STRING", description: "JSON string containing data to write/update if applicable." }
            };
            const required: string[] = [];
            
            if (data.parameters && data.parameters.length > 0) {
                data.parameters.forEach(p => {
                    properties[p.name] = {
                        type: p.type === 'number' ? 'NUMBER' : p.type === 'boolean' ? 'BOOLEAN' : 'STRING',
                        description: p.description
                    };
                    if (p.required) required.push(p.name);
                });
            } else {
                 // Default param if none defined to ensure valid JSON schema
                 properties['query'] = { type: "STRING", description: "Query context" };
            }

            tools.push({
                name: toolName,
                description: description,
                parameters: { type: "OBJECT", properties: properties, required: required }
            });
        }
        if (targetNode.type === NodeType.DEPARTMENT) {
            const data = targetNode.data as DepartmentNodeData;
            // Refined description for Orchestrator pattern
            const description = `CONSULT the ${data.agentName} backend agent. Use this when the user asks about: ${data.description}. The tool will return instructions on what to say next.`;
            tools.push({
                name: toolName,
                description: description,
                parameters: { 
                    type: "OBJECT",
                    properties: {
                        query: { type: "STRING", description: "The specific question or request details to verify with the specialist." } 
                    },
                    required: ["query"]
                } 
            });
        }
    });
    return tools;
  };

  /**
   * Executes tool logic for a SubAgentNode (Tool Agent)
   * NOW USES SHARED ToolExecutor (Phase 1.3 Migration)
   * Handles integration with Integration Nodes (mock, REST, GraphQL)
   * Includes comprehensive error handling, timeout, and response validation
   * @param toolNodeId - ID of the tool agent node
   * @param args - Arguments passed to the tool
   * @returns Normalized response with data or error
   */
  const executeToolLogic = async (toolNodeId: string, args: Record<string, any>): Promise<any> => {
      // Use shared ToolExecutor (Phase 1.3 migration - fallback removed)
      if (!toolExecutorRef.current) {
          const errorResponse = createErrorResponse(
              ErrorCode.TOOL_EXECUTOR_NOT_INITIALIZED,
              "ToolExecutor not initialized",
              { toolNodeId }
          );
          addLog('system', 'ToolExecutor not initialized - system error', errorResponse);
          return {
              success: false,
              error: errorResponse.message,
              errorCode: errorResponse.code,
              toolNodeId
          };
      }

      try {
          const result = await toolExecutorRef.current.executeTool(toolNodeId, args);
          return result;
      } catch (error: any) {
          const errorMsg = error.message || 'Unknown error occurred during tool execution';
          const errorCode = error.message?.includes('timeout') ? ErrorCode.TOOL_TIMEOUT : ErrorCode.TOOL_EXECUTION_ERROR;
          const errorResponse = createErrorResponse(errorCode, errorMsg, {
              toolNodeId,
              stack: error.stack
          });
          
          console.error("ToolExecutor Error:", error);
          addLog('system', `Tool execution failed: ${errorResponse.userFriendlyMessage || errorResponse.message}`, {
              toolNodeId,
              error: errorResponse.message,
              errorCode: errorResponse.code,
              retryable: errorResponse.retryable,
              stack: error.stack
          });
          
          onSetNodeError(toolNodeId, errorResponse.userFriendlyMessage || errorResponse.message);
          
          return {
              success: false,
              error: errorResponse.userFriendlyMessage || errorResponse.message,
              errorCode: errorResponse.code,
              toolNodeId,
              retryable: errorResponse.retryable
          };
      }
  };

  // Legacy fallback code removed (Phase 1.3 migration complete)
  // All tool execution now goes through ToolExecutor which uses IntegrationExecutor
  // This ensures consistent behavior and shared utilities across the system

  /**
   * Helper function to generate a summary of data structure for AI
   */
  const generateDataSummary = (data: any, depth: number = 0, maxDepth: number = 2): string => {
      if (depth > maxDepth) return '...';
      if (data === null || data === undefined) return 'null';
      if (typeof data === 'string') return `"${data.substring(0, 50)}${data.length > 50 ? '...' : ''}"`;
      if (typeof data === 'number' || typeof data === 'boolean') return String(data);
      if (Array.isArray(data)) {
          if (data.length === 0) return '[]';
          return `[${data.length} items: ${generateDataSummary(data[0], depth + 1, maxDepth)}]`;
      }
      if (typeof data === 'object') {
          const keys = Object.keys(data);
          if (keys.length === 0) return '{}';
          const preview = keys.slice(0, 5).map(k => `${k}: ${generateDataSummary(data[k], depth + 1, maxDepth)}`).join(', ');
          return keys.length > 5 ? `{${preview}, ...}` : `{${preview}}`;
      }
      return String(data);
  };

  /**
   * Helper function to describe data structure
   */
  const describeDataStructure = (data: any): string => {
      if (data === null || data === undefined) return 'null';
      if (typeof data !== 'object') return typeof data;
      if (Array.isArray(data)) {
          return `array[${data.length}]${data.length > 0 ? ` of ${describeDataStructure(data[0])}` : ''}`;
      }
      const keys = Object.keys(data);
      return `object with fields: ${keys.join(', ')}`;
  };

  // Legacy integration functions removed (Phase 1.3 Phase C cleanup)
  // All integration execution now goes through ToolExecutor → IntegrationExecutor
  // These functions are no longer used and have been removed to reduce code duplication


  /**
   * Executes a REST API integration
   */
  const executeRestIntegration = async (intData: IntegrationNodeData, args: Record<string, any>): Promise<any> => {
      if (!intData.url) {
          return {
              error: "REST integration URL is not configured",
              errorCode: "REST_NO_URL"
          };
      }

      try {
          // Build headers
          const headers: Record<string, string> = {
              'Content-Type': 'application/json'
          };

          // Add authentication headers
          if (intData.authType === 'bearer' && intData.authToken) {
              headers['Authorization'] = `Bearer ${intData.authToken}`;
          } else if (intData.authType === 'apiKey' && intData.apiHeaderName && intData.authToken) {
              headers[intData.apiHeaderName] = intData.authToken;
          }

          // Parse custom headers if provided
          if (intData.headers) {
              try {
                  const customHeaders = JSON.parse(intData.headers);
                  Object.assign(headers, customHeaders);
              } catch (e) {
                  addLog('debug', 'Failed to parse custom headers', { error: e });
              }
          }

          // Build request body
          let body: string | undefined;
          if (intData.body && (intData.method === 'POST' || intData.method === 'PUT' || intData.method === 'PATCH')) {
              body = intData.body;
          }

          // For demo purposes, simulate the request
          // In production, uncomment the actual fetch call
          /*
          const response = await fetch(intData.url, {
              method: intData.method || 'GET',
              headers,
              body
          });

          if (!response.ok) {
              return {
                  error: `REST API returned error: ${response.status} ${response.statusText}`,
                  errorCode: `REST_${response.status}`,
                  status: response.status
              };
          }

          const data = await response.json();
          return {
              status: "success",
              source: "rest_api",
              data,
              args_received: args
          };
          */

          // Simulated response for demo
          return { 
              status: "success", 
              source: "rest_api", 
              message: `Simulated ${intData.method || 'GET'} to ${intData.url}`, 
              data: { ...args, timestamp: Date.now() } 
          };
      } catch (e: any) {
          return { 
              error: `Network request failed to ${intData.url}: ${e.message}`, 
              errorCode: "REST_NETWORK_ERROR"
          };
      }
  };

  /**
   * Executes a GraphQL integration
   */
  const executeGraphQLIntegration = async (intData: IntegrationNodeData, args: Record<string, any>): Promise<any> => {
      if (!intData.graphQLQuery) {
          return {
              error: "GraphQL query is not configured",
              errorCode: "GRAPHQL_NO_QUERY"
          };
      }

      if (!intData.url) {
          return {
              error: "GraphQL endpoint URL is not configured",
              errorCode: "GRAPHQL_NO_URL"
          };
      }

      try {
          // Parse variables if provided
          let variables: any = {};
          if (intData.graphQLVariables) {
              try {
                  variables = JSON.parse(intData.graphQLVariables);
              } catch (e) {
                  return {
                      error: `Invalid GraphQL variables JSON: ${e}`,
                      errorCode: "GRAPHQL_INVALID_VARIABLES"
                  };
              }
          }

          // Merge with args
          variables = { ...variables, ...args };

          // Build headers
          const headers: Record<string, string> = {
              'Content-Type': 'application/json'
          };

          if (intData.authType === 'bearer' && intData.authToken) {
              headers['Authorization'] = `Bearer ${intData.authToken}`;
          }

          // For demo purposes, simulate the request
          // In production, uncomment the actual fetch call
          /*
          const response = await fetch(intData.url, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                  query: intData.graphQLQuery,
                  variables
              })
          });

          if (!response.ok) {
              return {
                  error: `GraphQL API returned error: ${response.status} ${response.statusText}`,
                  errorCode: `GRAPHQL_${response.status}`,
                  status: response.status
              };
          }

          const result = await response.json();
          
          if (result.errors) {
              return {
                  error: `GraphQL errors: ${JSON.stringify(result.errors)}`,
                  errorCode: "GRAPHQL_QUERY_ERROR",
                  errors: result.errors
              };
          }

          return {
              status: "success",
              source: "graphql_api",
              data: result.data,
              args_received: args
          };
          */

          // Simulated response for demo
          return { 
              status: "success", 
              source: "graphql_api", 
              message: `Simulated GraphQL query to ${intData.url}`, 
              data: { ...args, timestamp: Date.now() } 
          };
      } catch (e: any) {
          return { 
              error: `GraphQL request failed: ${e.message}`, 
              errorCode: "GRAPHQL_NETWORK_ERROR"
          };
      }
  };

  /**
   * Executes a sub-agent loop for DEPARTMENT nodes
   * Creates a separate Gemini chat session to handle complex logic with tool calls
   * Now supports bidirectional communication with the master agent
   * @param departmentNodeId - ID of the department node to execute
   * @param initialQuery - Query from master agent
   * @returns Normalized response string with instructions for master agent
   */
  const runSubAgentLoop = async (departmentNodeId: string, initialQuery: string): Promise<string> => {
      const startTime = Date.now();
      const depNode = nodesRef.current.find(n => n.id === departmentNodeId);
      
      if (!depNode) {
          const errorMsg = `Error: Department node not found (ID: ${departmentNodeId})`;
          addLog('system', `❌ ${errorMsg}`);
          onSetNodeError(departmentNodeId, errorMsg);
          return errorMsg;
      }
      
      const data = depNode.data as DepartmentNodeData;
      
      // Create trace span for sub-agent loop
      const subAgentTraceContext = tracerRef.current?.startSpan(
          `sub_agent_loop:${data.agentName || departmentNodeId}`,
          undefined,
          { departmentId: departmentNodeId, departmentName: data.agentName, query: initialQuery.substring(0, 100) }
      );
      
      addLog('system', `🔵 Consulting ${data.agentName}...`);
      addLog('debug', `Sub-Agent Request`, { 
          departmentId: departmentNodeId,
          departmentName: data.agentName,
          query: initialQuery,
          timestamp: startTime
      });
      
      // Highlight master agent and sub-agent with edge animation
      onSetActiveNodes([activeAgentId || '', departmentNodeId]);
      animateEdges([{ source: activeAgentId || '', target: departmentNodeId }]);
      
      // Keep highlighting visible for at least 1 second
      setTimeout(() => {
          // Highlight persists
      }, 1000);

      // Register department agent with CommunicationManager for bidirectional communication
      const masterAgentId = activeAgentId || '';
      const threadId = `thread_${masterAgentId}_${departmentNodeId}_${startTime}`;
      const context: ConversationContext = {
          threadId,
          sessionId: `session_${Date.now()}`,
          metadata: { initialQuery, departmentName: data.agentName }
      };

      // Register department agent handler for bidirectional messages
      if (commManagerRef.current) {
          commManagerRef.current.registerAgent(departmentNodeId, async (message: AgentMessage) => {
              addLog('debug', `Department Agent Received Message`, {
                  from: message.from,
                  type: message.type,
                  content: message.content
              });
              
              // Handle different message types
              if (message.type === 'QUERY' || message.type === 'CLARIFY') {
                  // Department agent can respond to queries
                  return { 
                      response: `I received your ${message.type}: ${JSON.stringify(message.content)}`,
                      timestamp: Date.now()
                  };
              }
              
              return { acknowledged: true, timestamp: Date.now() };
          });
      }
      
      try {
          const tools = generateToolsForAgent(departmentNodeId);
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
          
          // Use department's system prompt if available, otherwise use default
          // Enhanced with bidirectional communication capabilities and explicit tool response reading instructions
          const systemPrompt = data.systemPrompt || `
                    You are the ${data.agentName} Backend Logic Advisor.
                    Your goal is to answer the Master Agent's query: "${initialQuery}".
                    
                    BIDIRECTIONAL COMMUNICATION:
                    - You can ask the Master Agent for clarification if needed
                    - If you need more information, clearly state what you need
                    - You can request the Master Agent to ask the user for specific details
                    
                    HOW TO READ TOOL RESPONSES:
                    When you call a tool, you will receive a response with this structure:
                    {
                      "result": {
                        "success": true/false,
                        "data": { ... },  // THIS IS THE ACTUAL DATA - READ ALL FIELDS HERE
                        "summary": "...",  // Quick overview of what's in the data
                        "structure": "...",  // Description of the data structure
                        "error": "...",  // Only present if success is false
                        "errorCode": "..."  // Only present if there's an error
                      }
                    }
                    
                    CRITICAL INSTRUCTIONS FOR READING DATA:
                    1. The 'data' field contains the actual information you need - ALWAYS read this field
                    2. If 'data' is an object, read ALL fields in it (e.g., data.reservationNumber, data.status, data.date, etc.)
                    3. Use the 'summary' field to quickly understand what data is available
                    4. The 'structure' field tells you what type of data it is (object, array, etc.)
                    5. If success is false, check the 'error' and 'errorCode' fields
                    
                    EXAMPLE OF READING TOOL RESPONSE:
                    If tool returns: { "result": { "success": true, "data": { "reservationNumber": "ABC123", "status": "confirmed", "date": "2025-12-01" } } }
                    You should read: data.reservationNumber = "ABC123", data.status = "confirmed", data.date = "2025-12-01"
                    Then summarize: "Reservation ABC123 is confirmed for December 1, 2025"
                    
                    RULES:
                    1. You have tools. USE THEM IMMEDIATELY. Do not ask for clarification unless absolutely necessary.
                    2. When you receive tool results, ALWAYS read the 'data' field completely - extract ALL information from it
                    3. Your output must be a direct instruction to the Master Agent on what to say to the user.
                    4. If you find data, summarize ALL relevant details clearly - don't miss any important fields
                    5. If you need clarification, format it as: "CLARIFY: [your question]"
                    6. If you need the user's input, format it as: "ASK_USER: [what to ask]"
                    
                    Start by checking which tool can answer the query, then call it and READ ALL DATA from the response.
             `;
          
          const chat: Chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                 systemInstruction: systemPrompt,
                 tools: tools.length > 0 ? [{ functionDeclarations: tools }] : undefined
            }
          });
          
          // Wrap the entire operation in a timeout
          const executeLoop = async (): Promise<string> => {
              // Send the query to start the thinking process
              // Use proper SendMessageParameters format with message property
              let result: GenerateContentResponse = await chat.sendMessage({ 
                  message: [{ text: `Query: ${initialQuery}` }] 
              });
              
              let calls = result.functionCalls;
              let maxTurns = 5; // Increased from 3 to allow more complex workflows
              let turns = 0;

              // Process tool calls in a loop
              while (calls && calls.length > 0 && turns < maxTurns) {
                  turns++;
                  addLog('debug', `Sub-Agent Turn ${turns}/${maxTurns}`, { 
                      functionCalls: calls.length,
                      calls: calls.map(c => ({ name: c.name, id: c.id }))
                  });
                  
                  const parts: Part[] = [];
                  
                  for (const call of calls) {
                      const toolName = call.name;
                      const args = call.args;
                      
                      // Match tool execution back to node using unique name
                      const targetNode = nodesRef.current.find(n => getToolName(n) === toolName);
                      
                      if (targetNode && edgesRef.current.some(e => e.source === departmentNodeId && e.target === targetNode.id)) {
                          const toolAgentId = targetNode.id;
                          
                          // Visual Feedback - highlight department, tool agent, and any connected integration
                          const integrationEdge = edgesRef.current.find(
                              e => e.source === toolAgentId && 
                              nodesRef.current.find(n => n.id === e.target)?.type === NodeType.INTEGRATION
                          );
                          const integrationNodeId = integrationEdge?.target;
                          const nodesToHighlight = [departmentNodeId, toolAgentId];
                          if (integrationNodeId) {
                              nodesToHighlight.push(integrationNodeId);
                          }
                          onSetActiveNodes(nodesToHighlight);
                          animateEdges([
                              { source: departmentNodeId, target: toolAgentId },
                              ...(integrationNodeId ? [{ source: toolAgentId, target: integrationNodeId }] : [])
                          ]);
                          addLog('debug', `Sub-Agent Calling Tool: ${toolName}`, { 
                              toolId: toolAgentId,
                              integrationNodeId,
                              args: args,
                              callId: call.id
                          });

                          try {
                              // Execute the Logic (Integration or Mock) with timeout
                              const toolResult = await withTimeout(
                                  executeToolLogic(toolAgentId, args as Record<string, any>),
                                  DEFAULT_COMM_CONFIG.timeout.toolExecution,
                                  `Tool execution timeout after ${DEFAULT_COMM_CONFIG.timeout.toolExecution}ms`
                              );
                              
                              // Log detailed tool result before formatting
                              addLog('debug', `Tool Result (Before Formatting)`, { 
                                  toolName,
                                  toolAgentId,
                                  rawResult: toolResult,
                                  success: !toolResult.error,
                                  hasData: !!toolResult.data,
                                  dataType: toolResult.data ? typeof toolResult.data : 'null',
                                  summary: toolResult.summary || 'N/A',
                                  structure: toolResult.structure || 'N/A',
                                  dataPreview: toolResult.data ? JSON.stringify(toolResult.data).substring(0, 300) : 'null'
                              });

                              // Format tool result in AI-friendly way
                              // The AI needs clear access to the data
                              const formattedResult = {
                                  success: toolResult.success !== false && !toolResult.error,
                                  data: toolResult.data || toolResult,  // Ensure data is accessible
                                  summary: toolResult.summary || (toolResult.data ? generateDataSummary(toolResult.data) : 'No data returned'),
                                  structure: toolResult.structure || (toolResult.data ? describeDataStructure(toolResult.data) : 'unknown'),
                                  ...(toolResult.error ? { error: toolResult.error, errorCode: toolResult.errorCode } : {})
                              };

                              // Log formatted result that will be sent to sub-agent
                              addLog('debug', `Tool Result (Formatted for Sub-Agent)`, {
                                  toolName,
                                  toolAgentId,
                                  formattedResult,
                                  formattedDataPreview: formattedResult.data ? JSON.stringify(formattedResult.data).substring(0, 300) : 'null',
                                  willBeSentToSubAgent: true
                              });

                              parts.push({ 
                                  functionResponse: {
                                      id: call.id,
                                      name: toolName,
                                      response: { 
                                          result: formattedResult,
                                          // Add explicit instruction for AI
                                          _instruction: "The 'data' field contains the actual data. Use 'summary' to understand what's available. Read all fields in the data object."
                                      }
                                  }
                              });
                              
                              // Log that response was added to parts
                              addLog('debug', `Tool Response Added to Sub-Agent`, {
                                  toolName,
                                  callId: call.id,
                                  responseAdded: true
                              });
                          } catch (toolError: any) {
                              const errorMsg = toolError.message || 'Tool execution failed';
                              const errorResponse = createErrorResponse(
                                  ErrorCode.TOOL_EXECUTION_FAILED,
                                  errorMsg,
                                  { toolName, callId: call.id }
                              );
                              addLog('debug', `Tool Error: ${toolName}`, { 
                                  error: errorResponse.message,
                                  errorCode: errorResponse.code,
                                  callId: call.id
                              });
                              
                              parts.push({ 
                                  functionResponse: {
                                      id: call.id,
                                      name: toolName,
                                      response: { 
                                          result: { 
                                              error: errorResponse.userFriendlyMessage || errorResponse.message,
                                              errorCode: errorResponse.code
                                          } 
                                      }
                                  }
                              });
                          }
                      } else {
                          const errorMsg = `Tool disconnected or not found in workflow: ${toolName}`;
                          const errorResponse = createErrorResponse(
                              ErrorCode.TOOL_NOT_FOUND,
                              errorMsg,
                              { toolName, callId: call.id }
                          );
                          addLog('debug', `Tool Not Found`, { 
                              toolName,
                              errorCode: errorResponse.code,
                              callId: call.id
                          });
                          
                          parts.push({ 
                              functionResponse: {
                                  id: call.id,
                                  name: toolName,
                                  response: { 
                                      result: { 
                                          error: errorResponse.userFriendlyMessage || errorResponse.message,
                                          errorCode: errorResponse.code
                                      } 
                                  }
                              }
                          });
                      }
                  }
                  
                  // Log what we're sending back to sub-agent
                  addLog('debug', `Sending Tool Responses to Sub-Agent`, {
                      departmentNodeId,
                      partsCount: parts.length,
                      partsPreview: parts.map(p => ({
                          hasFunctionResponse: !!p.functionResponse,
                          functionName: p.functionResponse?.name,
                          callId: p.functionResponse?.id
                      }))
                  });
                  
                  // Send the tool responses back to the Department Agent
                  result = await chat.sendMessage({ message: parts });
                  calls = result.functionCalls;
                  
                  // Log sub-agent's response after receiving tool results
                  addLog('debug', `Sub-Agent Response After Tool Results`, {
                      departmentNodeId,
                      hasNewCalls: !!calls && calls.length > 0,
                      newCallsCount: calls?.length || 0,
                      hasText: !!result.text,
                      textPreview: result.text ? result.text.substring(0, 200) : 'null'
                  });
              }
              
              // Extract final response - check multiple possible locations
              let finalAnswer: string | null = null;
              
              // Log raw result structure
              addLog('debug', `Sub-Agent Final Response Extraction`, {
                  departmentNodeId,
                  hasText: !!result.text,
                  hasCandidates: !!result.candidates,
                  candidatesLength: result.candidates?.length || 0,
                  resultStructure: Object.keys(result)
              });
              
              // Try to get text from result
              if (result.text) {
                  finalAnswer = result.text;
                  addLog('debug', `Extracted Final Answer from result.text`, {
                      departmentNodeId,
                      answerLength: finalAnswer.length,
                      answerPreview: finalAnswer.substring(0, 200)
                  });
              } else if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
                  finalAnswer = result.candidates[0].content.parts[0].text;
                  addLog('debug', `Extracted Final Answer from result.candidates[0].content.parts[0].text`, {
                      departmentNodeId,
                      answerLength: finalAnswer.length,
                      answerPreview: finalAnswer.substring(0, 200)
                  });
              } else {
                  addLog('debug', `Could not extract text from result`, {
                      departmentNodeId,
                      resultKeys: Object.keys(result),
                      resultPreview: JSON.stringify(result).substring(0, 500)
                  });
              }
              
              // Validate response
              const validation = validateSubAgentResponse({ text: finalAnswer || '' });
              
              if (!validation.isValid) {
                  addLog('debug', 'Response Validation Failed', {
                      departmentNodeId,
                      error: validation.error,
                      errorCode: validation.errorCode,
                      finalAnswer: finalAnswer?.substring(0, 200),
                      result: result
                  });
                  
                  // Try to extract any meaningful content from the result
                  const fallbackText = JSON.stringify(result).substring(0, 200);
                  finalAnswer = `Unable to extract clear response. Raw data: ${fallbackText}`;
              }
              
              const duration = Date.now() - startTime;
              
              // Log final answer before normalization
              addLog('debug', `Sub-Agent Final Answer (Before Normalization)`, {
                  departmentNodeId,
                  finalAnswer: finalAnswer?.substring(0, 500),
                  answerLength: finalAnswer?.length || 0,
                  duration
              });
              
              // Check for bidirectional communication patterns
              if (finalAnswer) {
                  // Check for CLARIFY pattern
                  if (finalAnswer.includes('CLARIFY:')) {
                      const clarifyQuestion = finalAnswer.split('CLARIFY:')[1]?.trim();
                      if (clarifyQuestion && commManagerRef.current && masterAgentId) {
                          try {
                              const clarifyMessage = createMessage(
                                  departmentNodeId,
                                  masterAgentId,
                                  'CLARIFY',
                                  { question: clarifyQuestion, originalQuery: initialQuery },
                                  context,
                                  { priority: 'high' }
                              );
                              
                              // Log monitoring event
                              if (commMonitorRef.current) {
                                  commMonitorRef.current.log({
                                      id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                                      from: departmentNodeId,
                                      to: masterAgentId,
                                      type: 'CLARIFY',
                                      timestamp: Date.now(),
                                      success: true,
                                      metadata: { question: clarifyQuestion }
                                  });
                              }
                              
                              addLog('system', `🔵 ${data.agentName} requesting clarification: ${clarifyQuestion}`);
                              // Send clarification request (for now, return it as part of response)
                              // In full implementation, this would wait for master agent response
                              return `I need clarification: ${clarifyQuestion}. Please provide this information.`;
                          } catch (error: any) {
                              addLog('debug', 'Failed to send clarification request', { error: error.message });
                          }
                      }
                  }
                  
                  // Check for ASK_USER pattern
                  if (finalAnswer.includes('ASK_USER:')) {
                      const userQuestion = finalAnswer.split('ASK_USER:')[1]?.trim();
                      if (userQuestion) {
                          addLog('system', `🔵 ${data.agentName} needs to ask user: ${userQuestion}`);
                          return `Please ask the user: ${userQuestion}`;
                      }
                  }
              }
              
              const normalized = normalizeSubAgentResponse(
                  { text: finalAnswer || '' },
                  'session',
                  { duration }
              );
              
              // Log normalized response
              addLog('debug', `Sub-Agent Response Normalized`, {
                  departmentNodeId,
                  success: normalized.success,
                  hasInstructions: !!normalized.data?.instructions,
                  instructionsPreview: normalized.data?.instructions?.substring(0, 200),
                  error: normalized.error,
                  errorCode: normalized.errorCode
              });
              
              // Log communication event
              if (commMonitorRef.current && masterAgentId) {
                  commMonitorRef.current.log({
                      id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                      from: departmentNodeId,
                      to: masterAgentId,
                      type: 'INFORM',
                      timestamp: Date.now(),
                      duration,
                      success: normalized.success,
                      error: normalized.error,
                      errorCode: normalized.errorCode,
                      threadId: context.threadId,
                      metadata: { response: finalAnswer?.substring(0, 100) }
                  });
              }
              
              if (normalized.success) {
                  const instructions = normalized.data?.instructions || finalAnswer || '';
                  
                  // End sub-agent trace
                  if (subAgentTraceContext) {
                      tracerRef.current?.endSpan(subAgentTraceContext.spanId, {
                          success: true,
                          duration,
                          turnCount: turns,
                          hasResponse: true
                      });
                  }
                  
                  addLog('system', `🔵 ${data.agentName} responded (${duration}ms)`, {
                      preview: instructions.substring(0, 100)
                  });
                  onSetActiveNodes([activeAgentId || '']); // Reset focus to Master
                  return instructions;
              } else {
                  const errorMsg = normalized.error || 'Sub-agent returned invalid response';
                  
                  // End sub-agent trace with error
                  if (subAgentTraceContext) {
                      tracerRef.current?.endSpan(subAgentTraceContext.spanId, {
                          success: false,
                          duration,
                          error: errorMsg,
                          errorCode: normalized.errorCode
                      });
                  }
                  
                  addLog('system', `❌ ${data.agentName} Error: ${errorMsg}`);
                  onSetNodeError(departmentNodeId, errorMsg);
                  return `Error: ${errorMsg}. Please try again or contact support.`;
              }
          };
          
          // Execute with retry and timeout
          if (DEFAULT_COMM_CONFIG.retry.enabled) {
              return await withRetry(
                  () => withTimeout(
                      executeLoop(),
                      DEFAULT_COMM_CONFIG.timeout.subAgentLoop,
                      `Sub-agent loop timeout after ${DEFAULT_COMM_CONFIG.timeout.subAgentLoop}ms`
                  ),
                  {
                      maxRetries: DEFAULT_COMM_CONFIG.retry.maxRetries,
                      initialDelay: DEFAULT_COMM_CONFIG.retry.initialDelay,
                      maxDelay: DEFAULT_COMM_CONFIG.retry.maxDelay,
                      shouldRetry: isRetryableError
                  }
              );
          } else {
              return await withTimeout(
                  executeLoop(),
                  DEFAULT_COMM_CONFIG.timeout.subAgentLoop,
                  `Sub-agent loop timeout after ${DEFAULT_COMM_CONFIG.timeout.subAgentLoop}ms`
              );
          }
          
      } catch (error: any) {
          const duration = Date.now() - startTime;
          const errorMsg = error.message || 'Unknown error occurred';
          const errorCode = error.message?.includes('timeout') ? ErrorCode.REQUEST_TIMEOUT : ErrorCode.PROCESSING_ERROR;
          const errorResponse = createErrorResponse(errorCode, errorMsg, {
              departmentNodeId,
              agentName: data.agentName,
              duration,
              stack: error.stack
          });
          
          console.error("Sub-Agent Logic Error:", error);
          addLog('debug', 'Sub-Agent Error', { 
              error: errorResponse.message,
              errorCode: errorResponse.code,
              retryable: errorResponse.retryable,
              stack: error.stack,
              duration
          });
          
          // Log error event
          if (commMonitorRef.current && activeAgentId) {
              commMonitorRef.current.log({
                  id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                  from: departmentNodeId,
                  to: activeAgentId,
                  type: 'ERROR',
                  timestamp: Date.now(),
                  duration,
                  success: false,
                  error: errorResponse.message,
                  errorCode: errorResponse.code,
                  threadId: context.threadId
              });
          }
          
          onSetNodeError(departmentNodeId, errorResponse.userFriendlyMessage || errorResponse.message);
          
          // End sub-agent trace with error
          if (subAgentTraceContext) {
              tracerRef.current?.endSpan(subAgentTraceContext.spanId, {
                  success: false,
                  duration,
                  error: errorResponse.message,
                  errorCode: errorResponse.code
              });
          }
          
          // Return user-friendly error message
          if (errorCode === ErrorCode.REQUEST_TIMEOUT) {
              return `The ${data.agentName} department took too long to respond. Please try again with a simpler request.`;
          }
          
          return `I encountered an error while processing your request with ${data.agentName}. ${errorResponse.userFriendlyMessage || errorResponse.message}`;
      } finally {
          // Cleanup: Unregister agent when done
          if (commManagerRef.current) {
              commManagerRef.current.unregisterAgent(departmentNodeId);
          }
      }
  };

  const establishSession = async (agentNodeId: string, isHandoff: boolean = false) => {
    if (geminiRef.current) { geminiRef.current.disconnect(); geminiRef.current = null; }
    const agentNode = nodesRef.current.find(n => n.id === agentNodeId);
    if (!agentNode) return;
    const agentData = agentNode.data as RouterNodeData;
    let systemPrompt = agentData.systemPrompt || "You are a helpful assistant.";
    
    // Inject the "Single Voice" prompt to the Master Agent
    if (!isHandoff) {
        systemPrompt = HUMAN_PROMPT + "\n\n" + systemPrompt;
    }
    
    const tools = generateToolsForAgent(agentNodeId);
    
    // Create GeminiClient with resilience features (Phase 2)
    const client = new GeminiClient({
        apiKey: process.env.API_KEY,
        voiceName: agentData.voiceId || 'Zephyr',
        systemInstruction: systemPrompt,
        tools: tools,
        // Add resilience features
        rateLimiter: rateLimiterRef.current || undefined,
        rateLimitConfig: {
          maxRequests: 60,
          windowMs: 60000
        },
        circuitBreaker: circuitBreakerRef.current || undefined,
        onRateLimit: (retryAfter) => {
          addLog('system', `Rate limit exceeded. Please wait ${retryAfter} seconds.`, { retryAfter });
          updateResilienceStatus();
        },
        onCircuitOpen: () => {
          addLog('system', 'Circuit breaker opened - Gemini API temporarily unavailable', { severity: 'error' });
          if (degradationManagerRef.current) {
            degradationManagerRef.current.reportFailure('llm', 'Circuit breaker opened');
          }
          updateResilienceStatus();
        }
    });
    geminiRef.current = client;
    
    // Update status after client creation
    updateResilienceStatus();

    client.onAudioData = async (audioData) => {
        if (audioContextRef.current) {
            const buffer = await decodeAudioData(audioData, audioContextRef.current);
            playAudioBuffer(buffer);
        }
    };
    client.onTranscription = (text, role, isFinal) => {
        if (activeSpeakerRef.current !== role) {
            if (activeSpeakerRef.current) {
                const previousText = transcriptBufferRef.current[activeSpeakerRef.current];
                if (previousText && previousText.trim().length > 0) {
                    addLog(activeSpeakerRef.current === 'model' ? 'agent' : 'user', previousText);
                    transcriptBufferRef.current[activeSpeakerRef.current] = '';
                    setLiveTranscript(prev => ({ ...prev, [activeSpeakerRef.current!]: '' }));
                }
            }
            activeSpeakerRef.current = role;
        }
        if (text) {
            transcriptBufferRef.current[role] += text;
            setLiveTranscript(prev => ({ ...prev, [role]: transcriptBufferRef.current[role] }));
        }
        if (isFinal && role === 'model') {
             const finalText = transcriptBufferRef.current.model;
             if (finalText && finalText.trim().length > 0) {
                 addLog('agent', finalText);
                 transcriptBufferRef.current.model = '';
                 setLiveTranscript(prev => ({ ...prev, model: '' }));
             }
        }
    };
    /**
     * Handles tool calls from the master agent
     * Routes to either DEPARTMENT nodes (session-based) or SUB_AGENT nodes (direct execution)
     * Includes comprehensive error handling and response normalization
     */
    client.onToolCall = async (toolCalls): Promise<ToolCallResponse[]> => {
        const responses: ToolCallResponse[] = [];
        
        // Create trace for tool call batch
        const toolCallTraceContext = tracerRef.current?.startSpan(
            'master_agent_tool_calls',
            undefined,
            { toolCount: toolCalls.length, agentId: agentNodeId }
        );
        
        for (const tc of toolCalls) {
            const toolName = tc.name;
            const args = tc.args || {};
            const startTime = Date.now();

            // Create trace span for individual tool call
            const toolSpanContext = tracerRef.current?.startSpan(
                `tool_call:${toolName}`,
                toolCallTraceContext,
                { toolName, callId: tc.id, args: JSON.stringify(args).substring(0, 100) }
            );

            addLog('debug', `Master Agent Tool Call`, {
                toolName,
                args,
                callId: tc.id,
                timestamp: startTime
            });

            try {
                // Resolve node using unique name with fallback
                let targetNode = nodesRef.current.find(n => getToolName(n) === toolName);
                
                // Fallback: try to find by node ID if name match fails
                if (!targetNode && args.nodeId) {
                    targetNode = nodesRef.current.find(n => n.id === args.nodeId);
                }

                if (!targetNode) {
                    const errorMsg = `Tool "${toolName}" not found or disconnected`;
                    const errorResponse = createErrorResponse(
                        ErrorCode.TOOL_NOT_FOUND,
                        errorMsg,
                        { toolName }
                    );
                    addLog('system', `❌ ${errorResponse.userFriendlyMessage || errorMsg}`);
                    addLog('debug', 'Tool Resolution Failed', {
                        toolName,
                        errorCode: errorResponse.code,
                        availableTools: nodesRef.current
                            .filter(n => n.type === NodeType.DEPARTMENT || n.type === NodeType.SUB_AGENT)
                            .map(n => ({ id: n.id, name: getToolName(n), type: n.type }))
                    });
                    
                    responses.push({ 
                        id: tc.id, 
                        result: { 
                            error: errorResponse.userFriendlyMessage || errorResponse.message,
                            errorCode: errorResponse.code,
                            message: 'The requested tool is not available. Please check your workflow configuration.'
                        } 
                    });
                    continue;
                }

                // Handle Consultations (Master -> Department) - Session-based
                if (targetNode.type === NodeType.DEPARTMENT) {
                    try {
                        const query = args.query || "Provide status/instructions.";
                        const departmentName = (targetNode.data as DepartmentNodeData).agentName;
                        
                        // Add trace tag for department name
                        if (toolSpanContext) {
                            tracerRef.current?.addSpanTag(toolSpanContext.spanId, 'department', departmentName);
                            tracerRef.current?.addSpanTag(toolSpanContext.spanId, 'service', 'department_consultation');
                        }
                        
                        addLog('system', `🔵 Consulting ${departmentName}...`);
                        
                        // Execute the sub-agent loop
                        const subAgentResponse = await runSubAgentLoop(targetNode.id, query as string);
                        
                        // Normalize and transform response
                        const normalized = normalizeSubAgentResponse(
                            { text: subAgentResponse },
                            'session',
                            { duration: Date.now() - startTime }
                        );
                        
                        const transformed = transformResponseForMaster(normalized);
                        
                        // End tool span
                        if (toolSpanContext) {
                            tracerRef.current?.endSpan(toolSpanContext.spanId, {
                                success: normalized.success,
                                duration: Date.now() - startTime,
                                hasResponse: !!subAgentResponse
                            });
                        }
                        
                        addLog('debug', 'Department Response', {
                            toolName,
                            normalized,
                            transformed,
                            duration: Date.now() - startTime
                        });

                        responses.push({ 
                            id: tc.id, 
                            result: transformed
                        });
                        
                        setMetrics(prev => ({ ...prev, totalInteractions: prev.totalInteractions + 1 }));
                        continue;
                    } catch (error: any) {
                        const errorMsg = error.message || 'Department consultation failed';
                        
                        // End tool span with error
                        if (toolSpanContext) {
                            tracerRef.current?.endSpan(toolSpanContext.spanId, {
                                success: false,
                                error: errorMsg,
                                errorCode: 'DEPARTMENT_ERROR'
                            });
                        }
                        
                        addLog('system', `❌ Department Error: ${errorMsg}`);
                        addLog('debug', 'Department Error Details', {
                            toolName,
                            error: errorMsg,
                            stack: error.stack,
                            duration: Date.now() - startTime
                        });
                        
                        responses.push({ 
                            id: tc.id, 
                            result: { 
                                error: errorMsg,
                                errorCode: 'DEPARTMENT_ERROR',
                                message: `Unable to consult ${(targetNode.data as DepartmentNodeData).agentName}. Please try again.`
                            } 
                        });
                        continue;
                    }
                }
                
                // Handle Direct Tools (Master -> Tool Agent) - Direct execution
                if (targetNode.type === NodeType.SUB_AGENT) {
                    try {
                        const toolData = targetNode.data as SubAgentNodeData;
                        
                        // Add trace tags
                        if (toolSpanContext) {
                            tracerRef.current?.addSpanTag(toolSpanContext.spanId, 'service', toolData.specialty || toolData.agentName || 'tool');
                            tracerRef.current?.addSpanTag(toolSpanContext.spanId, 'toolId', targetNode.id);
                        }
                        
                        onSetActiveNodes([agentNodeId, targetNode.id]);
                        animateEdges([{ source: agentNodeId, target: targetNode.id }]);
                        addLog('system', `Executing ${toolName}...`);
                        
                        // Execute tool logic with timeout
                        const resultData = await withTimeout(
                            executeToolLogic(targetNode.id, args as Record<string, any>),
                            DEFAULT_COMM_CONFIG.timeout.toolExecution,
                            `Tool execution timeout after ${DEFAULT_COMM_CONFIG.timeout.toolExecution}ms`
                        );
                        
                        // Normalize response
                        const normalized = normalizeSubAgentResponse(
                            resultData,
                            'direct',
                            { duration: Date.now() - startTime }
                        );
                        
                        const transformed = transformResponseForMaster(normalized);
                        
                        // End tool span
                        if (toolSpanContext) {
                            tracerRef.current?.endSpan(toolSpanContext.spanId, {
                                success: normalized.success,
                                duration: Date.now() - startTime,
                                isGoal: toolData.isGoal || false
                            });
                        }
                        
                        addLog('debug', `Direct Tool Result`, {
                            toolName,
                            resultData,
                            normalized,
                            transformed,
                            success: normalized.success,
                            duration: Date.now() - startTime
                        });

                        // Track Goals
                        if (toolData.isGoal && normalized.success) {
                            setMetrics(prev => ({ 
                                ...prev, 
                                successfulResolutions: prev.successfulResolutions + 1, 
                                isSessionResolved: true 
                            }));
                            addLog('system', `✅ GOAL ACHIEVED`);
                        }
                        
                        setMetrics(prev => ({ ...prev, totalInteractions: prev.totalInteractions + 1 }));
                        
                        responses.push({ 
                            id: tc.id, 
                            result: transformed
                        });
                        
                        setTimeout(() => onSetActiveNodes([agentNodeId]), 1000);
                        continue;
                    } catch (error: any) {
                        const errorMsg = error.message || 'Tool execution failed';
                        const errorCode = error.message?.includes('timeout') ? 'TOOL_TIMEOUT' : 'TOOL_EXECUTION_ERROR';
                        
                        // End tool span with error
                        if (toolSpanContext) {
                            tracerRef.current?.endSpan(toolSpanContext.spanId, {
                                success: false,
                                error: errorMsg,
                                errorCode
                            });
                        }
                        
                        addLog('system', `❌ Tool Error: ${errorMsg}`);
                        addLog('debug', 'Tool Error Details', {
                            toolName,
                            error: errorMsg,
                            errorCode,
                            stack: error.stack,
                            duration: Date.now() - startTime
                        });
                        
                        onSetNodeError(targetNode.id, errorMsg);
                        
                        responses.push({ 
                            id: tc.id, 
                            result: { 
                                error: errorMsg,
                                errorCode,
                                message: `Tool execution failed: ${errorMsg}. Please check the tool configuration.`
                            } 
                        });
                        
                        setTimeout(() => onSetActiveNodes([agentNodeId]), 1000);
                        continue;
                    }
                }

                // Unknown node type
                const errorMsg = `Unknown node type for tool "${toolName}"`;
                addLog('system', `❌ ${errorMsg}`);
                responses.push({ 
                    id: tc.id, 
                    result: { 
                        error: errorMsg,
                        errorCode: 'UNKNOWN_NODE_TYPE'
                    } 
                });
                
            } catch (error: any) {
                // Catch-all for any unexpected errors
                const errorMsg = error.message || 'Unexpected error during tool call';
                
                // End tool span with error
                if (toolSpanContext) {
                    tracerRef.current?.endSpan(toolSpanContext.spanId, {
                        success: false,
                        error: errorMsg,
                        errorCode: 'UNEXPECTED_ERROR'
                    });
                }
                
                console.error('Unexpected error in onToolCall:', error);
                addLog('debug', 'Unexpected Tool Call Error', {
                    toolName,
                    error: errorMsg,
                    stack: error.stack
                });
                
                responses.push({ 
                    id: tc.id, 
                    result: { 
                        error: errorMsg,
                        errorCode: 'UNEXPECTED_ERROR',
                        message: 'An unexpected error occurred. Please try again.'
                    } 
                });
            }
        }
        
        // End batch trace
        if (toolCallTraceContext) {
            tracerRef.current?.endSpan(toolCallTraceContext.spanId, {
                toolCount: toolCalls.length,
                responseCount: responses.length
            });
        }
        
        return responses;
    };
    await client.connect();
    await client.startRecording();
    setActiveAgentId(agentNodeId);
    onSetActiveNodes([agentNodeId]);
    if (!isHandoff && agentData.speaksFirst && agentData.firstSentence) {
        setTimeout(async () => {
            try {
                await client.sendText(`[System: Immediately say: "${agentData.firstSentence}"]`);
            } catch (error) {
                console.error('Failed to send initial greeting text:', error);
                // Don't block the call if initial text fails
            }
        }, 500);
    }
  };

  const startCall = async () => {
    if (!process.env.API_KEY) { setApiKeyError(true); return; }
    onClearNodeErrors();
    setSessionDuration(0);
    setMetrics({ totalInteractions: 0, successfulResolutions: 0, isSessionResolved: false });
    transcriptBufferRef.current = { user: '', model: '' };
    conversationHistoryRef.current = "";
    setLiveTranscript({ user: '', model: '' });
    setLogs([]); 
    activeSpeakerRef.current = null;
    const masterNode = nodesRef.current.find(n => n.type === NodeType.ROUTER);
    if (!masterNode) { addLog('system', 'Error: No Master Agent found.'); return; }
    if (isCallActive) return;
    
    // Check Microphone Permissions explicitly
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop()); // Release immediately, client will request again
    } catch (e) {
        addLog('system', '❌ Microphone Error: Permission denied or unavailable.');
        alert("Microphone access blocked. If using Chrome on non-localhost, ensure you are using HTTPS or enable 'Insecure origins treated as secure' in chrome://flags.");
        return;
    }

    setIsCallActive(true);
    durationIntervalRef.current = setInterval(() => setSessionDuration(prev => prev + 1), 1000);
    
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (audioContextRef.current) audioContextRef.current.close();
    audioContextRef.current = new AudioContextClass({ sampleRate: 24000 }); 
    nextStartTimeRef.current = audioContextRef.current.currentTime;
    const analyser = audioContextRef.current.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;
    drawWaveform();
    try { 
        await establishSession(masterNode.id, false); 
    } catch (err) { 
        console.error("Session failed:", err);
        addLog('system', '❌ Failed to connect to Gemini. Check API Key.');
        endCall(); 
    }
  };

  const endCall = () => {
    if (geminiRef.current) { geminiRef.current.disconnect(); geminiRef.current = null; }
    if (durationIntervalRef.current) { clearInterval(durationIntervalRef.current); durationIntervalRef.current = null; }
    if (audioContextRef.current) { try { audioContextRef.current.close(); } catch (e) { } audioContextRef.current = null; }
    if (animationRef.current) { cancelAnimationFrame(animationRef.current); animationRef.current = 0; }
    setIsCallActive(false);
    setActiveAgentId(null);
    onSetActiveNodes([]); 
    setLiveTranscript({ user: '', model: '' });
  };

  // Audio helpers
  const decodeAudioData = async (arrayBuffer: ArrayBuffer, ctx: AudioContext) => {
      const int16Data = new Int16Array(arrayBuffer);
      const float32Data = new Float32Array(int16Data.length);
      for (let i = 0; i < int16Data.length; i++) { float32Data[i] = int16Data[i] / 32768.0; }
      const buffer = ctx.createBuffer(1, float32Data.length, 24000);
      buffer.getChannelData(0).set(float32Data);
      return buffer;
  };
  const playAudioBuffer = (buffer: AudioBuffer) => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    if (analyserRef.current) { source.connect(analyserRef.current); analyserRef.current.connect(ctx.destination); } 
    else { source.connect(ctx.destination); }
    const currentTime = ctx.currentTime;
    if (nextStartTimeRef.current < currentTime) { nextStartTimeRef.current = currentTime; }
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += buffer.duration;
  };
  const drawWaveform = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const draw = () => {
        if (!analyserRef.current) return; 
        animationRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const barWidth = (canvas.width / dataArray.length) * 2.5;
        let x = 0;
        for (let i = 0; i < dataArray.length; i++) {
            const barHeight = dataArray[i] / 1.5;
            const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
            gradient.addColorStop(0, '#818cf8'); // Indigo-400
            gradient.addColorStop(1, '#c084fc'); // Purple-400
            ctx.fillStyle = gradient;
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    };
    draw();
  };

  return (
    <aside className="w-[420px] h-full bg-white border-l border-slate-200 flex flex-col shadow-xl z-20 font-sans">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 bg-white flex flex-col gap-3 z-10">
            <div className="flex justify-between items-center">
                <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                    <div className="p-1.5 bg-amber-50 rounded-md text-amber-500">
                        <Zap size={16} className="fill-current" />
                    </div>
                    Simulator
                </h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowSessionMemory(!showSessionMemory)}
                        className={`p-2 rounded-lg transition-colors ${
                            showSessionMemory 
                                ? 'bg-purple-100 text-purple-600' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                        title="Toggle Session Memory"
                    >
                        <Brain size={16} />
                    </button>
                    <button
                        onClick={() => setShowObservability(!showObservability)}
                        className={`p-2 rounded-lg transition-colors ${
                            showObservability 
                                ? 'bg-indigo-100 text-indigo-600' 
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                        title="Toggle Observability"
                    >
                        <Activity size={16} />
                    </button>
                    <div className={`flex items-center gap-2 text-[10px] font-bold px-3 py-1 rounded-full border transition-all ${isCallActive ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                        <div className={`w-2 h-2 rounded-full ${isCallActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                        {isCallActive ? 'LIVE SESSION' : 'IDLE'}
                    </div>
                </div>
            </div>
            
            {/* App Variant Selector */}
            <div className="flex items-center gap-2">
                <label className="text-[10px] font-medium text-slate-600 whitespace-nowrap">App Variant:</label>
                <select
                    value={selectedAppVariant}
                    onChange={(e) => {
                        setSelectedAppVariant(e.target.value);
                        if (e.target.value && testPanelAdapterRef.current) {
                            testPanelAdapterRef.current.loadAppVariant(e.target.value).catch(err => {
                                console.error('Failed to load app variant:', err);
                                addLog('system', `❌ Failed to load app variant: ${err.message}`);
                            });
                        }
                    }}
                    className="flex-1 text-[10px] px-2 py-1.5 border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                    <option value="">None (Use Node Config)</option>
                    <option value="hospitality_hotel_v1">🏨 Hotel Management</option>
                    <option value="travel_airline_v1">✈️ Airline Booking</option>
                    <option value="ecommerce_support_v1">🛒 E-Commerce Support</option>
                </select>
            </div>

            {/* Mode Tabs */}
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
                <button
                    onClick={() => setSimulationMode('voice')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-medium transition-all ${
                        simulationMode === 'voice'
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-slate-600 hover:text-slate-800'
                    }`}
                >
                    <Mic size={12} />
                    Voice
                </button>
                <button
                    onClick={() => setSimulationMode('text')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-medium transition-all ${
                        simulationMode === 'text'
                            ? 'bg-white text-indigo-600 shadow-sm'
                            : 'text-slate-600 hover:text-slate-800'
                    }`}
                >
                    <Type size={12} />
                    Text
                </button>
            </div>
        </div>

        {/* System Status Panel */}
        <Suspense fallback={<div className="flex items-center justify-center h-full text-slate-400 text-sm">Loading system status...</div>}>
            <SystemStatusPanel
                performanceMonitor={performanceMonitorRef.current || undefined}
                healthChecker={healthCheckerRef.current || undefined}
                analyticsManager={analyticsManagerRef.current || undefined}
                autoRefresh={true}
                refreshInterval={5000}
            />
        </Suspense>

        {/* Resilience Status Panel (Phase 2) */}
        {resilienceStatus && (
          <div className="bg-white border-b border-slate-200">
            <div className="px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-50 rounded-md">
                  <ShieldAlert size={14} className="text-amber-600" />
                </div>
                <span className="text-xs font-bold text-slate-700">Resilience Status</span>
              </div>
              {resilienceStatus.degradation !== null && (
                <div className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                  resilienceStatus.degradation === DegradationLevel.FULL ? 'bg-green-50 text-green-600 border-green-200' :
                  resilienceStatus.degradation === DegradationLevel.REDUCED ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                  resilienceStatus.degradation === DegradationLevel.MINIMAL ? 'bg-orange-50 text-orange-600 border-orange-200' :
                  'bg-red-50 text-red-600 border-red-200'
                }`}>
                  {DegradationLevel[resilienceStatus.degradation]}
                </div>
              )}
            </div>
            <div className="px-4 pb-3 space-y-2 border-t border-slate-100 bg-slate-50/50">
              {/* Circuit Breaker Status */}
              {resilienceStatus.circuitBreaker && (
                <div className="bg-white rounded-lg p-2 border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium text-slate-600">Circuit Breaker</span>
                    <div className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      resilienceStatus.circuitBreaker.state === CircuitState.CLOSED ? 'bg-green-100 text-green-700' :
                      resilienceStatus.circuitBreaker.state === CircuitState.OPEN ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {resilienceStatus.circuitBreaker.state.toUpperCase()}
                    </div>
                  </div>
                  {resilienceStatus.circuitBreaker.stats && (
                    <div className="text-[9px] text-slate-500">
                      Total: {resilienceStatus.circuitBreaker.stats.totalRequests || 0} | 
                      Success: {resilienceStatus.circuitBreaker.stats.totalSuccesses || 0} | 
                      Failures: {resilienceStatus.circuitBreaker.stats.totalFailures || 0}
                    </div>
                  )}
                </div>
              )}

              {/* Rate Limit Status */}
              {resilienceStatus.rateLimit && (
                <div className="bg-white rounded-lg p-2 border border-slate-200">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium text-slate-600">Rate Limit</span>
                    <div className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      resilienceStatus.rateLimit.allowed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {resilienceStatus.rateLimit.allowed ? 'OK' : 'LIMIT'}
                    </div>
                  </div>
                  <div className="text-[9px] text-slate-500">
                    Remaining: {resilienceStatus.rateLimit.remaining || 0}
                    {resilienceStatus.rateLimit.retryAfter && (
                      <span className="ml-2 text-orange-600">
                        Retry in: {resilienceStatus.rateLimit.retryAfter}s
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Session Memory Panel */}
        {showSessionMemory && (
            <div className="border-b border-slate-200 h-96">
                <Suspense fallback={<div className="flex items-center justify-center h-full text-slate-400 text-sm">Loading session memory...</div>}>
                    <SessionMemoryPanel
                        stateManager={stateManagerRef.current || undefined}
                        sessionId={simulationMode === 'text' ? textSessionId : undefined}
                        autoRefresh={true}
                        refreshInterval={2000}
                    />
                </Suspense>
            </div>
        )}

        {/* Observability Panel */}
        {showObservability && (
            <div className="border-b border-slate-200 h-96">
                <Suspense fallback={<div className="flex items-center justify-center h-full text-slate-400 text-sm">Loading observability...</div>}>
                    <ObservabilityPanel
                        performanceMonitor={performanceMonitorRef.current || undefined}
                        healthChecker={healthCheckerRef.current || undefined}
                        analyticsManager={analyticsManagerRef.current || undefined}
                        tracer={tracerRef.current || undefined}
                        reliabilityTracker={reliabilityTrackerRef.current || undefined}
                        logger={loggerRef.current || undefined}
                        dashboardProvider={dashboardProviderRef.current || undefined}
                        autoRefresh={true}
                        refreshInterval={5000}
                    />
                </Suspense>
            </div>
        )}

        {/* Text Mode Interface */}
        {simulationMode === 'text' && (
            <div className="flex-1 flex flex-col border-b border-slate-200 bg-slate-50">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {logs.length === 0 && (
                        <div className="text-center text-slate-300 mt-20 text-xs">
                            Start a text conversation by typing below
                        </div>
                    )}
                    {logs.map(log => {
                        if (log.role === 'debug') return <DebugLogItem key={log.id} log={log} />;
                        if (log.role === 'system') {
                            return (
                                <div key={log.id} className="flex justify-center my-2 animate-fadeIn">
                                    <div className={`text-[10px] font-medium px-3 py-1 rounded-full border shadow-sm flex items-center gap-1.5 max-w-[90%] text-center ${
                                        log.text.includes('Error') || log.text.includes('Failed') ? 'bg-rose-50 text-rose-600 border-rose-100' : 
                                        log.text.includes('GOAL') ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                                        log.text.includes('Consulting') ? 'bg-cyan-50 text-cyan-600 border-cyan-100' :
                                        log.text.includes('Mock Data') || log.text.includes('mock data') ? 'bg-purple-50 text-purple-600 border-purple-100' :
                                        log.text.includes('Tool Result') || log.text.includes('tool result') ? 'bg-yellow-50 text-yellow-600 border-yellow-100' :
                                        'bg-white text-slate-500 border-slate-200'
                                    }`}>
                                        {log.text.includes('GOAL') && <Target size={10} />}
                                        {log.text.includes('Consulting') && <Network size={10} />}
                                        {(log.text.includes('Mock Data') || log.text.includes('mock data')) && <FileJson size={10} />}
                                        {(log.text.includes('Tool Result') || log.text.includes('tool result')) && <Zap size={10} />}
                                        {log.text}
                                    </div>
                                </div>
                            );
                        }
                        const isUser = log.role === 'user';
                        return (
                            <div key={log.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fadeIn group`}>
                                <div className={`flex flex-col max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                                    <div className="flex items-center gap-2 mb-1 px-1">
                                        {isUser ? (
                                            <>
                                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">User</span>
                                                <User size={10} className="text-slate-400"/>
                                            </>
                                        ) : (
                                            <>
                                                <Bot size={12} className="text-indigo-400"/>
                                                <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider">AI Agent</span>
                                            </>
                                        )}
                                    </div>
                                    <div 
                                        className={`p-3 rounded-2xl shadow-sm text-xs leading-relaxed border relative ${
                                            isUser 
                                            ? 'bg-indigo-600 text-white rounded-tr-sm border-indigo-600' 
                                            : 'bg-white text-slate-700 rounded-tl-sm border-slate-200'
                                        }`}
                                        title={log.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                                    >
                                        {log.text}
                                    </div>
                                    <span className="text-[9px] text-slate-400 mt-1 opacity-0 group-hover:opacity-100 transition-opacity px-1 font-mono">
                                        {log.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
                <div className="p-3 bg-white border-t border-slate-200">
                    <form
                        onSubmit={async (e) => {
                            e.preventDefault();
                            if (!textInput.trim() || !testPanelAdapterRef.current || isAgentTyping) return;
                            
                            const userMessage = textInput.trim();
                            setTextInput('');
                            addLog('user', userMessage);
                            setIsAgentTyping(true);
                            
                            try {
                                // Add natural thinking delay
                                await addNaturalDelay();
                                
                                const response = await testPanelAdapterRef.current.processCallerInput(
                                    userMessage,
                                    textSessionId
                                );
                                addLog('agent', response);
                                setMetrics(prev => ({ ...prev, totalInteractions: prev.totalInteractions + 1 }));
                            } catch (error: any) {
                                addLog('system', `❌ Error: ${error.message}`);
                            } finally {
                                setIsAgentTyping(false);
                            }
                        }}
                        className="flex gap-2"
                    >
                        <input
                            type="text"
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                            placeholder="Type your message..."
                            className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <button
                            type="submit"
                            disabled={!textInput.trim() || isAgentTyping}
                            className="px-4 py-2 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Send
                        </button>
                    </form>
                    {/* Typing Indicator */}
                    {isAgentTyping && (
                        <div className="mt-2 flex items-center gap-2 text-[10px] text-indigo-600 font-medium animate-fadeIn bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-100">
                            <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                            </div>
                            <span className="font-medium">Agent is thinking...</span>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* API Key Error */}
        {apiKeyError && (
            <div className="bg-rose-50 border-b border-rose-100 p-3 flex items-start gap-3">
                <div className="p-1 bg-rose-100 rounded text-rose-600"><AlertTriangle size={14} /></div>
                <div>
                    <div className="text-xs font-bold text-rose-700">API Key Missing</div>
                    <div className="text-[10px] text-rose-600 mt-0.5">Please check <code>process.env.API_KEY</code>.</div>
                </div>
            </div>
        )}

        {/* Audio Visualizer (Voice Mode Only) */}
        {simulationMode === 'voice' && (
        <div className="h-44 bg-slate-900 border-b border-slate-200 relative flex flex-col overflow-hidden">
             <canvas ref={canvasRef} width={420} height={176} className="w-full h-full object-cover opacity-90" />
             
             {isCallActive && activeAgentId && (
                 <div className="absolute top-3 left-3 z-10 animate-fadeIn">
                     <div className="bg-white/10 backdrop-blur-md text-white border border-white/20 text-[10px] font-medium px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-2">
                         <Bot size={12} className="text-indigo-300"/>
                         <span className="font-bold uppercase tracking-wider text-[9px]">Agent:</span>
                         {nodes.find(n => n.id === activeAgentId)?.data.label}
                     </div>
                 </div>
             )}

             {metrics.isSessionResolved && (
                 <div className="absolute top-3 right-3 z-10 animate-fadeIn">
                     <div className="bg-amber-500/90 backdrop-blur text-white text-[10px] font-bold px-2.5 py-1 rounded-lg shadow-lg flex items-center gap-1.5">
                         <Target size={12} /> GOAL MET
                     </div>
                 </div>
             )}

             {/* Live Transcription Overlay */}
             <div className="absolute inset-0 p-4 flex flex-col justify-end space-y-2 pointer-events-none">
                 {liveTranscript.user && (
                     <div className="self-end max-w-[85%] animate-slideIn flex justify-end">
                        <div className="bg-indigo-500/90 text-white text-xs px-3 py-2 rounded-2xl rounded-tr-sm shadow-md leading-relaxed backdrop-blur-sm border border-indigo-400/50">
                            {liveTranscript.user}
                        </div>
                     </div>
                 )}
                 {liveTranscript.model && (
                     <div className="self-start max-w-[85%] animate-slideIn">
                         <div className="bg-slate-700/80 text-white text-xs px-3 py-2 rounded-2xl rounded-tl-sm shadow-md leading-relaxed backdrop-blur-sm border border-slate-600/50">
                            {liveTranscript.model}
                         </div>
                     </div>
                 )}
             </div>

             {!isCallActive && (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-xs text-slate-400 bg-slate-50/50 gap-2 backdrop-blur-sm">
                    <div className="p-3 bg-white rounded-full shadow-lg border border-slate-100 mb-2">
                        <Activity size={24} className="text-slate-300" />
                    </div>
                    <span className="font-medium bg-white px-3 py-1 rounded-full shadow-sm border border-slate-100">Ready to simulate</span>
                </div>
             )}
        </div>
        )}

        {/* Stats Bar */}
        <MetricsDisplay
          sessionDuration={sessionDuration}
          metrics={metrics}
          departmentCount={departmentCount}
          toolCount={toolCount}
          onDownloadLog={() => {
            // TODO: Implement log download functionality
          }}
        />

        {/* Chat Logs (Voice Mode Only) */}
        {simulationMode === 'voice' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/30 scrollbar-thin scrollbar-thumb-slate-200">
             {logs.length === 0 && <div className="text-center text-slate-300 mt-20 text-xs">No activity yet</div>}
             
             {logs.map(log => {
                 if (log.role === 'debug') return <DebugLogItem key={log.id} log={log} />;
                 
                 if (log.role === 'system') {
                    return (
                        <div key={log.id} className="flex justify-center my-2 animate-fadeIn">
                             <div className={`text-[10px] font-medium px-3 py-1 rounded-full border shadow-sm flex items-center gap-1.5 max-w-[90%] text-center ${
                                log.text.includes('Error') || log.text.includes('Failed') ? 'bg-rose-50 text-rose-600 border-rose-100' : 
                                log.text.includes('GOAL') ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                                log.text.includes('Consulting') ? 'bg-cyan-50 text-cyan-600 border-cyan-100' :
                                'bg-white text-slate-500 border-slate-200'
                            }`}>
                                {log.text.includes('GOAL') && <Target size={10} />}
                                {log.text.includes('Consulting') && <Network size={10} />}
                                {log.text}
                            </div>
                        </div>
                    );
                 }

                 const isUser = log.role === 'user';
                 return (
                    <div key={log.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'} animate-fadeIn group`}>
                        <div className={`flex flex-col max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                            <div className="flex items-center gap-2 mb-1 px-1">
                                {isUser ? (
                                    <>
                                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">User</span>
                                        <User size={10} className="text-slate-400"/>
                                    </>
                                ) : (
                                    <>
                                        <Bot size={12} className="text-indigo-400"/>
                                        <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider">AI Agent</span>
                                    </>
                                )}
                            </div>
                            <div className={`p-3 rounded-2xl shadow-sm text-xs leading-relaxed border ${
                                isUser 
                                ? 'bg-indigo-600 text-white rounded-tr-sm border-indigo-600' 
                                : 'bg-white text-slate-700 rounded-tl-sm border-slate-200'
                            }`}>
                                {log.text}
                            </div>
                            <span className="text-[9px] text-slate-300 mt-1 opacity-0 group-hover:opacity-100 transition-opacity px-1">
                                {log.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}
                            </span>
                        </div>
                    </div>
                 );
             })}
             <div ref={logsEndRef} />
        </div>
        )}

        {/* Controls (Voice Mode Only) */}
        {simulationMode === 'voice' && (
          <VoiceControls
            isCallActive={isCallActive}
            sessionDuration={sessionDuration}
            apiKeyError={apiKeyError}
            onStartCall={startCall}
            onEndCall={endCall}
          />
        )}
    </aside>
  );
};

export default TestPanel;
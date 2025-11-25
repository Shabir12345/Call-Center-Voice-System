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

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, Mic, Square, Play, Pause, Volume2, Activity, MessageSquare, AlertTriangle, Clock, Download, Coins, Zap, CheckCircle2, Target, ShieldAlert, ChevronDown, ChevronRight, ArrowRightLeft, Network, Bot, User } from 'lucide-react';
import { GeminiClient, ToolCallResponse } from '../utils/geminiClient';
import { AppNode, Edge, NodeType, RouterNodeData, SubAgentNodeData, IntegrationNodeData, DepartmentNodeData, CommunicationConfig, AgentMessage, ConversationContext } from '../types';
import { GoogleGenAI, Chat, GenerateContentResponse, Part } from "@google/genai";
import { validateSubAgentResponse, normalizeSubAgentResponse, transformResponseForMaster, withTimeout, withRetry, isRetryableError } from '../utils/responseValidator';
import { CommunicationManager } from '../utils/agentCommunication';
import { CommunicationMonitor } from '../utils/communicationMonitor';
import { createMessage } from '../utils/communicationProtocols';

interface TestPanelProps {
  nodes: AppNode[];
  edges: Edge[];
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  onSetActiveNodes: (nodeIds: string[]) => void;
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
  return (
      <div className="flex flex-col my-1 animate-fadeIn max-w-[90%] self-center w-full">
           <div 
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-md cursor-pointer hover:bg-slate-200 transition-colors"
              onClick={() => setExpanded(!expanded)}
           >
               {expanded ? <ChevronDown size={12} className="text-slate-500"/> : <ChevronRight size={12} className="text-slate-500"/>}
               <Network size={12} className="text-slate-500" />
               <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wide flex-1 truncate">{log.text}</span>
               <span className="text-[9px] text-slate-400 font-mono">DEBUG</span>
           </div>
           {expanded && log.details && (
               <div className="mt-1 ml-4 p-2 bg-slate-800 rounded-md text-slate-300 font-mono text-[10px] overflow-x-auto border border-slate-700 shadow-inner">
                   <pre>{JSON.stringify(log.details, null, 2)}</pre>
               </div>
           )}
      </div>
  );
};

const TestPanel: React.FC<TestPanelProps> = ({ nodes, edges, setEdges, onSetActiveNodes, onSetNodeError, onClearNodeErrors }) => {
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
  
  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const durationIntervalRef = useRef<any>(null);
  const conversationHistoryRef = useRef<string>(""); 
  const transcriptBufferRef = useRef<{user: string, model: string}>({ user: '', model: '' });
  const activeSpeakerRef = useRef<'user' | 'model' | null>(null);

  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
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
  
  // Initialize communication system
  useEffect(() => {
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
      });
    }

    return () => {
      // Cleanup on unmount
      if (commManagerRef.current) {
        commManagerRef.current.clear();
      }
    };
  }, []);

  useEffect(() => {
      if (!process.env.API_KEY) {
          setApiKeyError(true);
      }
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

  const formatDuration = (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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
            }
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
   * Handles integration with Integration Nodes (mock, REST, GraphQL)
   * Includes comprehensive error handling, timeout, and response validation
   * @param toolNodeId - ID of the tool agent node
   * @param args - Arguments passed to the tool
   * @returns Normalized response with data or error
   */
  const executeToolLogic = async (toolNodeId: string, args: Record<string, any>): Promise<any> => {
      const startTime = Date.now();
      const toolNode = nodesRef.current.find(n => n.id === toolNodeId);
      
      if (!toolNode) {
          const error = { 
              error: "Tool Node not found", 
              errorCode: "TOOL_NODE_NOT_FOUND",
              toolNodeId 
          };
          addLog('debug', 'Tool Node Not Found', error);
          return error;
      }

      const toolData = toolNode.data as SubAgentNodeData;
      addLog('debug', `Executing Tool: ${toolData.agentName || toolData.specialty}`, {
          toolNodeId,
          args,
          timestamp: startTime
      });

      try {
          // Check for connected Integration Node (downstream)
          const integrationEdge = edgesRef.current.find(
              e => e.source === toolNodeId && 
              nodesRef.current.find(n => n.id === e.target)?.type === NodeType.INTEGRATION
          );
          const integrationNode = integrationEdge 
              ? nodesRef.current.find(n => n.id === integrationEdge.target) 
              : null;

          if (integrationNode) {
              const intData = integrationNode.data as IntegrationNodeData;
              addLog('debug', `Hitting Integration: ${intData.label}`, { 
                  type: intData.integrationType, 
                  url: intData.url,
                  method: intData.method || 'GET'
              });
              
              // Simulate latency if configured
              if (intData.latency && intData.latency > 0) {
                  await new Promise(r => setTimeout(r, intData.latency));
              }

              // Execute integration based on type
              const executeIntegration = async () => {
                  if (intData.integrationType === 'mock') {
                      return await executeMockIntegration(intData, args);
                  } else if (intData.integrationType === 'rest' && intData.url) {
                      return await executeRestIntegration(intData, args);
                  } else if (intData.integrationType === 'graphql' && intData.graphQLQuery) {
                      return await executeGraphQLIntegration(intData, args);
                  } else {
                      return {
                          error: `Integration type ${intData.integrationType} not properly configured`,
                          errorCode: 'INTEGRATION_CONFIG_ERROR'
                      };
                  }
              };

              // Execute with timeout
              const result = await withTimeout(
                  executeIntegration(),
                  DEFAULT_COMM_CONFIG.timeout.toolExecution,
                  `Integration execution timeout after ${DEFAULT_COMM_CONFIG.timeout.toolExecution}ms`
              );

              const duration = Date.now() - startTime;
              const normalized = normalizeSubAgentResponse(result, 'direct', { duration });
              
              addLog('debug', `Tool Execution Complete`, {
                  toolNodeId,
                  success: normalized.success,
                  duration,
                  hasData: !!normalized.data
              });

              return normalized.success ? normalized.data : { 
                  error: normalized.error,
                  errorCode: normalized.errorCode
              };
          }

          // Fallback: If no integration node, return a generic success
          // This ensures the chain doesn't break even if the user didn't wire up a DB node.
          const duration = Date.now() - startTime;
          addLog('debug', `Tool executed without integration node`, {
              toolNodeId,
              duration
          });
          
          return { 
              status: "success", 
              message: "Tool executed (Internal Mock)", 
              details: "Connect an Integration Node to this Tool Agent to fetch real data.",
              input_args: args 
          };
      } catch (error: any) {
          const duration = Date.now() - startTime;
          const errorMsg = error.message || 'Unknown error occurred during tool execution';
          const errorCode = error.message?.includes('timeout') ? 'TOOL_TIMEOUT' : 'TOOL_EXECUTION_ERROR';
          
          console.error("Tool Execution Error:", error);
          addLog('debug', 'Tool Execution Error', {
              toolNodeId,
              error: errorMsg,
              errorCode,
              stack: error.stack,
              duration
          });
          
          onSetNodeError(toolNodeId, errorMsg);
          
          return {
              error: errorMsg,
              errorCode,
              toolNodeId
          };
      }
  };

  /**
   * Executes a mock integration
   */
  const executeMockIntegration = async (intData: IntegrationNodeData, args: Record<string, any>): Promise<any> => {
      try {
          if (!intData.mockOutput) {
              return {
                  error: "Mock integration has no output data configured",
                  errorCode: "MOCK_NO_OUTPUT"
              };
          }

          const mockData = JSON.parse(intData.mockOutput);
          
          // Validate parsed JSON
          if (typeof mockData !== 'object') {
              return {
                  error: "Mock output must be a JSON object",
                  errorCode: "MOCK_INVALID_FORMAT"
              };
          }

          return { 
              status: "success", 
              source: "mock_db", 
              data: mockData, 
              args_received: args 
          };
      } catch (e: any) {
          return { 
              error: `Integration Node has invalid JSON mock output: ${e.message}`, 
              errorCode: "MOCK_JSON_PARSE_ERROR"
          };
      }
  };

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
      addLog('system', `🔵 Consulting ${data.agentName}...`);
      addLog('debug', `Sub-Agent Request`, { 
          departmentId: departmentNodeId,
          departmentName: data.agentName,
          query: initialQuery,
          timestamp: startTime
      });
      
      onSetActiveNodes([activeAgentId || '', departmentNodeId]);
      animateEdges([{ source: activeAgentId || '', target: departmentNodeId }]);

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
          // Enhanced with bidirectional communication capabilities
          const systemPrompt = data.systemPrompt || `
                    You are the ${data.agentName} Backend Logic Advisor.
                    Your goal is to answer the Master Agent's query: "${initialQuery}".
                    
                    BIDIRECTIONAL COMMUNICATION:
                    - You can ask the Master Agent for clarification if needed
                    - If you need more information, clearly state what you need
                    - You can request the Master Agent to ask the user for specific details
                    
                    RULES:
                    1. You have tools. USE THEM IMMEDIATELY. Do not ask for clarification unless absolutely necessary.
                    2. Your output must be a direct instruction to the Master Agent on what to say to the user.
                    3. If you find data, summarize it clearly.
                    4. If you need clarification, format it as: "CLARIFY: [your question]"
                    5. If you need the user's input, format it as: "ASK_USER: [what to ask]"
                    
                    Start by checking which tool can answer the query.
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
              // Fix: Use proper Part format with parts array for Content Union
              let result: GenerateContentResponse = await chat.sendMessage([{ parts: [{ text: `Query: ${initialQuery}` }] }]);
              
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
                          
                          // Visual Feedback
                          onSetActiveNodes([departmentNodeId, toolAgentId]);
                          animateEdges([{ source: departmentNodeId, target: toolAgentId }]);
                          addLog('debug', `Sub-Agent Calling Tool: ${toolName}`, { 
                              toolId: toolAgentId,
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
                              
                              addLog('debug', `Tool Result`, { 
                                  toolName,
                                  result: toolResult,
                                  success: !toolResult.error
                              });

                              parts.push({ 
                                  functionResponse: {
                                      id: call.id,
                                      name: toolName,
                                      response: { result: toolResult }
                                  }
                              });
                          } catch (toolError: any) {
                              const errorMsg = toolError.message || 'Tool execution failed';
                              addLog('debug', `Tool Error: ${toolName}`, { 
                                  error: errorMsg,
                                  callId: call.id
                              });
                              
                              parts.push({ 
                                  functionResponse: {
                                      id: call.id,
                                      name: toolName,
                                      response: { 
                                          result: { 
                                              error: errorMsg,
                                              errorCode: 'TOOL_EXECUTION_FAILED'
                                          } 
                                      }
                                  }
                              });
                          }
                      } else {
                          const errorMsg = `Tool disconnected or not found in workflow: ${toolName}`;
                          addLog('debug', `Tool Not Found`, { 
                              toolName,
                              callId: call.id
                          });
                          
                          parts.push({ 
                              functionResponse: {
                                  id: call.id,
                                  name: toolName,
                                  response: { 
                                      result: { 
                                          error: errorMsg,
                                          errorCode: 'TOOL_NOT_FOUND'
                                      } 
                                  }
                              }
                          });
                      }
                  }
                  
                  // Send the tool responses back to the Department Agent
                  result = await chat.sendMessage(parts);
                  calls = result.functionCalls;
              }
              
              // Extract final response - check multiple possible locations
              let finalAnswer: string | null = null;
              
              // Try to get text from result
              if (result.text) {
                  finalAnswer = result.text;
              } else if (result.response?.text) {
                  finalAnswer = result.response.text;
              } else if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
                  finalAnswer = result.candidates[0].content.parts[0].text;
              }
              
              // Validate response
              const validation = validateSubAgentResponse({ text: finalAnswer || '' });
              
              if (!validation.isValid) {
                  addLog('debug', 'Response Validation Failed', {
                      error: validation.error,
                      errorCode: validation.errorCode,
                      result: result
                  });
                  
                  // Try to extract any meaningful content from the result
                  const fallbackText = JSON.stringify(result).substring(0, 200);
                  finalAnswer = `Unable to extract clear response. Raw data: ${fallbackText}`;
              }
              
              const duration = Date.now() - startTime;
              
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
                  addLog('system', `🔵 ${data.agentName} responded (${duration}ms)`, {
                      preview: instructions.substring(0, 100)
                  });
                  onSetActiveNodes([activeAgentId || '']); // Reset focus to Master
                  return instructions;
              } else {
                  const errorMsg = normalized.error || 'Sub-agent returned invalid response';
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
          const errorCode = error.message?.includes('timeout') ? 'TIMEOUT' : 'EXECUTION_ERROR';
          
          console.error("Sub-Agent Logic Error:", error);
          addLog('debug', 'Sub-Agent Error', { 
              error: errorMsg,
              errorCode,
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
                  error: errorMsg,
                  errorCode,
                  threadId: context.threadId
              });
          }
          
          onSetNodeError(departmentNodeId, errorMsg);
          
          // Return user-friendly error message
          if (errorCode === 'TIMEOUT') {
              return `The ${data.agentName} department took too long to respond. Please try again with a simpler request.`;
          }
          
          return `I encountered an error while processing your request with ${data.agentName}. Error: ${errorMsg}. Please try again.`;
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
    const client = new GeminiClient({
        apiKey: process.env.API_KEY,
        voiceName: agentData.voiceId || 'Zephyr',
        systemInstruction: systemPrompt,
        tools: tools
    });
    geminiRef.current = client;

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
        
        for (const tc of toolCalls) {
            const toolName = tc.name;
            const args = tc.args || {};
            const startTime = Date.now();

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
                    addLog('system', `❌ ${errorMsg}`);
                    addLog('debug', 'Tool Resolution Failed', {
                        toolName,
                        availableTools: nodesRef.current
                            .filter(n => n.type === NodeType.DEPARTMENT || n.type === NodeType.SUB_AGENT)
                            .map(n => ({ id: n.id, name: getToolName(n), type: n.type }))
                    });
                    
                    responses.push({ 
                        id: tc.id, 
                        result: { 
                            error: errorMsg,
                            errorCode: 'TOOL_NOT_FOUND',
                            message: 'The requested tool is not available. Please check your workflow configuration.'
                        } 
                    });
                    continue;
                }

                // Handle Consultations (Master -> Department) - Session-based
                if (targetNode.type === NodeType.DEPARTMENT) {
                    try {
                        const query = args.query || "Provide status/instructions.";
                        addLog('system', `🔵 Consulting ${(targetNode.data as DepartmentNodeData).agentName}...`);
                        
                        // Execute the sub-agent loop
                        const subAgentResponse = await runSubAgentLoop(targetNode.id, query as string);
                        
                        // Normalize and transform response
                        const normalized = normalizeSubAgentResponse(
                            { text: subAgentResponse },
                            'session',
                            { duration: Date.now() - startTime }
                        );
                        
                        const transformed = transformResponseForMaster(normalized);
                        
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
                        
                        addLog('debug', `Direct Tool Result`, {
                            toolName,
                            resultData,
                            normalized,
                            transformed,
                            success: normalized.success,
                            duration: Date.now() - startTime
                        });

                        // Track Goals
                        if ((targetNode.data as SubAgentNodeData).isGoal && normalized.success) {
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
        
        return responses;
    };
    await client.connect();
    await client.startRecording();
    setActiveAgentId(agentNodeId);
    onSetActiveNodes([agentNodeId]);
    if (!isHandoff && agentData.speaksFirst && agentData.firstSentence) {
        setTimeout(() => client.sendText(`[System: Immediately say: "${agentData.firstSentence}"]`), 500);
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
        <div className="p-4 border-b border-slate-100 bg-white flex justify-between items-center z-10">
            <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                <div className="p-1.5 bg-amber-50 rounded-md text-amber-500">
                    <Zap size={16} className="fill-current" />
                </div>
                Simulator
            </h2>
            <div className={`flex items-center gap-2 text-[10px] font-bold px-3 py-1 rounded-full border transition-all ${isCallActive ? 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-400'}`}>
                <div className={`w-2 h-2 rounded-full ${isCallActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`}></div>
                {isCallActive ? 'LIVE SESSION' : 'IDLE'}
            </div>
        </div>

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

        {/* Audio Visualizer */}
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

        {/* Stats Bar */}
        <div className="bg-white border-b border-slate-100 py-2 px-4 flex items-center justify-between text-[10px] font-medium text-slate-500">
             <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5" title="Duration">
                    <Clock size={12} className="text-indigo-500"/>
                    <span className="font-mono text-slate-700">{formatDuration(sessionDuration)}</span>
                </div>
                 <div className="flex items-center gap-1.5" title="Resolution">
                    <CheckCircle2 size={12} className={metrics.isSessionResolved ? "text-amber-500" : "text-slate-300"}/>
                    <span className={metrics.isSessionResolved ? "text-amber-600 font-bold" : "text-slate-400"}>
                        {metrics.successfulResolutions} Resolved
                    </span>
                </div>
             </div>
             <button onClick={() => {}} className="hover:text-indigo-600 transition-colors" title="Download Log">
                 <Download size={14} />
             </button>
        </div>

        {/* Chat Logs */}
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

        {/* Controls */}
        <div className="p-4 bg-white border-t border-slate-100 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-30">
            {!isCallActive ? (
                <button 
                    onClick={startCall}
                    disabled={apiKeyError}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-indigo-200 disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed transition-all active:scale-[0.98] group"
                >
                    <div className="p-1 bg-white/20 rounded-full group-hover:bg-white/30 transition-colors">
                        <Phone size={16} className="fill-current" />
                    </div>
                    Start Simulation
                </button>
            ) : (
                <div className="flex gap-3">
                    <button 
                        onClick={endCall}
                        className="flex-1 flex items-center justify-center gap-2 bg-rose-500 hover:bg-rose-600 text-white py-3.5 rounded-xl font-bold shadow-lg shadow-rose-200 transition-all active:scale-[0.98]"
                    >
                        <Square size={16} fill="currentColor" />
                        End Session
                    </button>
                    <button className="px-5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center transition-colors">
                        <Mic size={20} />
                    </button>
                </div>
            )}
            <div className="flex justify-center mt-3">
                <span className="text-[9px] font-medium text-slate-400 flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                    <Zap size={8} className="text-amber-400 fill-current" />
                    Powered by Gemini 2.5 Flash
                </span>
            </div>
        </div>
    </aside>
  );
};

export default TestPanel;
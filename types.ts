
import { Node, Edge } from 'reactflow';

export type { Edge };

export enum NodeType {
  ROUTER = 'routerNode',       // Master Agent
  DEPARTMENT = 'departmentNode', // Sub Agent (New)
  SUB_AGENT = 'subAgentNode',  // Tool Agent
  INTEGRATION = 'integrationNode',
  NOTE = 'noteNode',
  LOGIC = 'logicNode', // New Logic Node
  KNOWLEDGE_BASE = 'knowledgeBaseNode', // Knowledge Base Node
  CUSTOMER_PROFILE = 'customerProfileNode', // Customer Profile Node
}

// --- Database Types ---
export interface KnowledgeItem {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'snippet';
}

export interface KeyValueItem {
  id: string;
  key: string;
  value: string;
}

export interface DatabaseConfig {
  enabled: boolean;
  knowledgeBase: KnowledgeItem[];
  staticData: KeyValueItem[];
  memoryType: 'ephemeral' | 'session' | 'long_term';
  vectorSettings: {
    topK: number;
    threshold: number;
  };
  supabaseConfig: {
    tableName?: string;
    rlsPolicy?: string;
  };
}

// --- Voice & Interaction Settings ---
export interface VoiceSettings {
  speed: number; // 0.5 to 2.0
  interruptible: boolean;
  fillerWords: boolean;
}

// --- Call Recording Types ---
export interface CallRecording {
  id: string;
  sessionId: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  audioBlob?: Blob;
  audioUrl?: string;
  transcript?: string;
  metadata?: {
    agentId?: string;
    agentName?: string;
    callerId?: string;
    quality?: number;
    sentiment?: SentimentScore;
  };
}

// --- Sentiment Analysis Types ---
export interface SentimentScore {
  score: number; // -1 to 1 (negative to positive)
  label: 'positive' | 'neutral' | 'negative';
  confidence: number; // 0 to 1
  timestamp: number;
}

// --- Language Support Types ---
export type SupportedLanguage = 'en' | 'es' | 'fr' | 'de' | 'zh' | 'ja';

export interface LanguageConfig {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  systemPrompt?: string;
}

// --- CRM Integration Types ---
export interface CustomerProfile {
  id: string;
  phoneNumber?: string;
  email?: string;
  name?: string;
  company?: string;
  tags?: string[];
  customFields?: Record<string, any>;
  lastContact?: number;
  contactHistory?: Array<{
    date: number;
    type: 'call' | 'email' | 'chat';
    summary: string;
  }>;
}

export interface CRMConfig {
  provider: 'salesforce' | 'hubspot' | 'custom';
  apiUrl?: string;
  apiKey?: string;
  customHeaders?: Record<string, string>;
}

// --- Knowledge Base Types ---
export interface KnowledgeBaseArticle {
  id: string;
  title: string;
  content: string;
  category?: string;
  tags?: string[];
  lastUpdated: number;
  views?: number;
}

export interface KnowledgeBaseNodeData extends BaseNodeData {
  articles: KnowledgeBaseArticle[];
  searchType: 'keyword' | 'vector';
  vectorModel?: string;
}

// --- Customer Profile Node Types ---
export interface CustomerProfileNodeData extends BaseNodeData {
  crmConfig?: CRMConfig;
  autoDetect?: boolean;
  fields?: string[];
}

export interface BaseNodeData {
  label: string;
  active?: boolean; // Visual feedback for simulation
  error?: string; // Visual feedback for runtime errors
  databaseConfig?: DatabaseConfig;
  voiceSettings?: VoiceSettings; // New: Voice Control
  onDelete?: (id: string) => void;
  onDatabaseChange?: (id: string, config: DatabaseConfig) => void;
  onVoiceSettingsChange?: (id: string, settings: VoiceSettings) => void;
}

export interface RouterNodeData extends BaseNodeData {
  agentName: string;
  voiceId: string;
  style: string;
  systemPrompt: string;
  // Feature: Conversation Starter
  speaksFirst?: boolean;
  firstSentence?: string;
  // Feature: Safety Guardrails
  guardrails?: {
    bannedPhrases: string[];
    fallbackResponse?: string;
  };
  intents: string[];
  onAddIntent?: (id: string, intent: string) => void;
  onRemoveIntent?: (id: string, intent: string) => void;
  onEditIntent?: (id: string, oldIntent: string, newIntent: string) => void;
  
  // Feature: Bidirectional Communication
  bidirectionalEnabled?: boolean; // Enable bidirectional communication with sub-agents
  allowSubAgentQueries?: boolean; // Allow sub-agents to ask questions back
  communicationTimeout?: number; // Timeout for bidirectional messages (ms)
  
  // Feature: Multi-language Support
  language?: SupportedLanguage;
  autoDetectLanguage?: boolean;
  
  onFieldChange?: (id: string, field: string, value: string | any) => void;
  onApplyTemplate?: (id: string, templateId: string) => void;
}

export interface DepartmentNodeData extends BaseNodeData {
  agentName: string;
  description: string; // Instructions for the Master Agent
  systemPrompt: string; // Instructions for this Sub Agent
  model?: string; // 'flash' or 'pro'
  
  // Feature: Connected Tools
  tools?: string[];
  onAddTool?: (id: string, tool: string) => void;
  onRemoveTool?: (id: string, tool: string) => void;
  onEditTool?: (id: string, oldTool: string, newTool: string) => void;

  // Feature: Bidirectional Communication
  bidirectionalEnabled?: boolean; // Enable bidirectional communication
  maxConversationDepth?: number; // Maximum depth for nested conversations
  communicationTimeout?: number; // Timeout for bidirectional messages (ms)

  onFieldChange?: (id: string, field: string, value: string | any) => void;
}

export interface AgentParameter {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  description: string;
  required: boolean;
}

export interface SubAgentNodeData extends BaseNodeData {
  agentName?: string;
  specialty: string;
  accessLevel: string;
  datasource?: string;
  
  // Function Interface Config
  functionName?: string;
  apiEndpoint?: string;
  description?: string;
  parameters?: AgentParameter[];
  outputSchema?: string;

  // Success / Goal Tracking
  isGoal?: boolean;
  successCriteria?: string;

  onFieldChange?: (id: string, field: string, value: string | boolean) => void;
  onParamsChange?: (id: string, params: AgentParameter[]) => void;
}

export interface IntegrationNodeData extends BaseNodeData {
  integrationType: 'mock' | 'rest' | 'graphql' | 'calendar';
  url?: string;
  authType?: 'none' | 'bearer' | 'apiKey' | 'custom';
  apiHeaderName?: string;
  authToken?: string;
  headers?: string;
  dataStructure?: string;
  aiInstructions?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: string;
  graphQLQuery?: string;
  graphQLVariables?: string;
  mockOutput?: string;
  // Feature: Latency Simulation
  latency?: number; // in ms
  onFieldChange?: (id: string, field: keyof IntegrationNodeData, value: string | number) => void;
}

export interface LogicNodeData extends BaseNodeData {
  variableName: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'exists';
  value: string;
  onLogicChange?: (id: string, field: keyof LogicNodeData, value: string) => void;
}

export interface NoteNodeData extends BaseNodeData {
  text: string;
  color: string;
  onTextChange?: (id: string, text: string) => void;
  onColorChange?: (id: string, color: string) => void;
}

export type AppNodeData = RouterNodeData | DepartmentNodeData | SubAgentNodeData | IntegrationNodeData | NoteNodeData | LogicNodeData | KnowledgeBaseNodeData | CustomerProfileNodeData;

export type AppNode = Node<AppNodeData>;

// Feature: Project Management
export interface ProjectMetadata {
  id: string;
  name: string;
  lastModified: number;
}

export interface WorkflowExport {
  workflowId: string;
  timestamp: number;
  nodes: AppNode[];
  edges: Edge[];
  metadata: {
    version: string;
    agentCount: number;
  };
}

// --- Communication & Response Types ---

/**
 * Result of validating a sub-agent response
 */
export interface ValidationResult {
  isValid: boolean;
  error?: string;
  errorCode?: string;
  details?: any;
}

/**
 * Normalized response format for all sub-agent communications
 */
export interface NormalizedResponse {
  success: boolean;
  data: any;
  error?: string;
  errorCode?: string;
  metadata?: {
    source: 'direct' | 'session';
    timestamp: number;
    duration?: number;
    retryCount?: number;
  };
}

/**
 * Raw response from a sub-agent (before normalization)
 */
export interface SubAgentResponse {
  text?: string;
  data?: any;
  error?: string;
  functionCalls?: any[];
  [key: string]: any;
}

/**
 * Communication configuration settings
 */
export interface CommunicationConfig {
  timeout: {
    subAgentLoop: number; // milliseconds, default: 30000
    toolExecution: number; // milliseconds, default: 10000
  };
  retry: {
    enabled: boolean;
    maxRetries: number; // default: 2
    initialDelay: number; // milliseconds, default: 1000
    maxDelay: number; // milliseconds, default: 5000
  };
  logging: {
    enabled: boolean;
    level: 'debug' | 'info' | 'warn' | 'error';
  };
}

// --- Bidirectional Communication Types ---

/**
 * Message types following FIPA-ACL inspired protocol
 */
export type MessageType = 'INFORM' | 'QUERY' | 'REQUEST' | 'CONFIRM' | 'CLARIFY';

/**
 * Conversation context for maintaining state across agent interactions
 */
export interface ConversationContext {
  threadId: string; // Unique identifier for the conversation thread
  parentMessageId?: string; // ID of the message that initiated this conversation
  sessionId?: string; // Session identifier
  metadata?: Record<string, any>; // Additional context data
  history?: string[]; // Brief history of conversation
}

/**
 * Standardized message format for agent-to-agent communication
 */
export interface AgentMessage {
  id: string; // Unique message identifier
  from: string; // Source agent ID
  to: string; // Target agent ID
  type: MessageType; // Message type following protocol
  content: any; // Message payload
  context: ConversationContext; // Conversation context
  timestamp: number; // Unix timestamp in milliseconds
  requiresResponse: boolean; // Whether this message expects a response
  correlationId?: string; // For linking request/response pairs
  priority?: 'low' | 'normal' | 'high'; // Message priority
  expiresAt?: number; // Optional expiration timestamp
}

/**
 * Conversation thread tracking multiple related messages
 */
export interface ConversationThread {
  id: string; // Thread identifier
  participants: string[]; // Agent IDs involved in the conversation
  messages: AgentMessage[]; // All messages in the thread
  createdAt: number; // Thread creation timestamp
  updatedAt: number; // Last update timestamp
  status: 'active' | 'completed' | 'failed' | 'timeout'; // Thread status
  metadata?: Record<string, any>; // Additional thread metadata
}

/**
 * Communication event for monitoring and observability
 */
export interface CommunicationEvent {
  id: string; // Event identifier
  from: string; // Source agent ID
  to: string; // Target agent ID
  type: string; // Event type (message type or system event)
  timestamp: number; // Event timestamp
  duration?: number; // Duration in milliseconds (for completed events)
  success: boolean; // Whether the communication succeeded
  error?: string; // Error message if failed
  errorCode?: string; // Error code for categorization
  metadata?: Record<string, any>; // Additional event data
  messageId?: string; // Associated message ID if applicable
  threadId?: string; // Associated thread ID if applicable
}

/**
 * Bidirectional communication configuration
 */
export interface BidirectionalConfig {
  enabled: boolean; // Whether bidirectional communication is enabled
  maxConversationDepth: number; // Maximum depth of nested conversations
  timeout: number; // Timeout for bidirectional responses in milliseconds
  retryEnabled: boolean; // Whether to retry failed bidirectional calls
  maxRetries: number; // Maximum retry attempts
}

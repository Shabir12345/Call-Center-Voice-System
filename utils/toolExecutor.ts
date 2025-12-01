/**
 * Tool Executor
 * 
 * Shared utility for executing tool nodes (SubAgentNodes) with their connected Integration Nodes.
 * Extracts the tool execution pattern from TestPanel to make it reusable.
 * 
 * Features:
 * - Finds integration nodes connected to tool nodes
 * - Executes integrations via IntegrationExecutor
 * - Normalizes responses for consistency
 * - Generates data summaries and structure descriptions
 * - Supports UI callbacks for real-time updates
 */

import { AppNode, Edge, NodeType, SubAgentNodeData, IntegrationNodeData } from '../types';
import { IntegrationExecutor, IntegrationExecutorOptions, IntegrationExecutionResult } from './integrationExecutor';
import { normalizeSubAgentResponse } from './responseValidator';
import { CentralLogger } from './logger';
import { Tracer } from './tracing';

/**
 * Options for tool execution
 */
export interface ToolExecutorOptions {
  timeout?: number;
  retry?: {
    enabled: boolean;
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
  };
  logger?: CentralLogger;
  tracer?: Tracer;
  // Callbacks for UI updates (optional, for TestPanel integration)
  onSetActiveNodes?: (nodeIds: string[]) => void;
  onSetNodeError?: (nodeId: string, error: string) => void;
  onUpdateNodeUsage?: (nodeId: string) => void;
  onLog?: (level: 'debug' | 'system', text: string, details?: any) => void;
}

/**
 * Result of tool execution
 */
export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  errorCode?: string;
  summary?: string;
  structure?: string;
  metadata?: {
    source?: string;
    duration: number;
    [key: string]: any;
  };
}

/**
 * Tool Executor
 * 
 * Executes tool nodes by finding and executing their connected integration nodes.
 */
export class ToolExecutor {
  private integrationExecutor: IntegrationExecutor;
  private logger?: CentralLogger;
  private tracer?: Tracer;
  private options: ToolExecutorOptions;

  constructor(
    nodes: AppNode[],
    edges: Edge[],
    options: ToolExecutorOptions = {}
  ) {
    this.options = options;
    this.logger = options.logger;
    this.tracer = options.tracer;

    // Create IntegrationExecutor with merged options
    const integrationOptions: IntegrationExecutorOptions = {
      timeout: options.timeout || 10000,
      retry: options.retry || {
        enabled: true,
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 10000
      },
      logger: options.logger,
      tracer: options.tracer
    };

    this.integrationExecutor = new IntegrationExecutor(integrationOptions);
    
    // Store nodes and edges for execution
    this.nodes = nodes;
    this.edges = edges;
  }

  private nodes: AppNode[];
  private edges: Edge[];

  /**
   * Update nodes and edges (for dynamic workflows)
   */
  updateNodesAndEdges(nodes: AppNode[], edges: Edge[]): void {
    this.nodes = nodes;
    this.edges = edges;
  }

  /**
   * Execute a tool node
   * 
   * @param toolNodeId - ID of the tool agent node (SubAgentNode)
   * @param args - Arguments passed to the tool
   * @param options - Optional execution options
   * @returns Normalized tool execution result
   */
  async executeTool(
    toolNodeId: string,
    args: Record<string, any> = {},
    options?: {
      traceContext?: { spanId: string; tracer: Tracer };
      timeout?: number;
    }
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const toolNode = this.nodes.find(n => n.id === toolNodeId);

    if (!toolNode) {
      const error: ToolExecutionResult = {
        success: false,
        error: "Tool Node not found",
        errorCode: "TOOL_NODE_NOT_FOUND",
        metadata: { duration: Date.now() - startTime }
      };
      
      this.log('debug', 'Tool Node Not Found', { toolNodeId, error });
      if (this.options.onSetNodeError) {
        this.options.onSetNodeError(toolNodeId, error.error!);
      }
      return error;
    }

    if (toolNode.type !== NodeType.SUB_AGENT) {
      const error: ToolExecutionResult = {
        success: false,
        error: `Node ${toolNodeId} is not a tool node (SubAgentNode)`,
        errorCode: "INVALID_NODE_TYPE",
        metadata: { duration: Date.now() - startTime }
      };
      
      this.log('debug', 'Invalid Node Type', { toolNodeId, nodeType: toolNode.type, error });
      return error;
    }

    const toolData = toolNode.data as SubAgentNodeData;
    this.log('debug', `Executing Tool: ${toolData.agentName || toolData.specialty}`, {
      toolNodeId,
      args,
      timestamp: startTime
    });

    try {
      // Find connected Integration Node (downstream)
      const integrationEdge = this.edges.find(
        e => e.source === toolNodeId &&
        this.nodes.find(n => n.id === e.target)?.type === NodeType.INTEGRATION
      );
      
      const integrationNode = integrationEdge
        ? this.nodes.find(n => n.id === integrationEdge.target)
        : null;

      if (integrationNode) {
        const intData = integrationNode.data as IntegrationNodeData;

        // Create trace span for integration execution
        const integrationTraceContext = this.tracer?.startSpan(
          `integration:${intData.integrationType}`,
          options?.traceContext?.spanId ? { spanId: options.traceContext.spanId } : undefined,
          {
            integrationType: intData.integrationType,
            url: intData.url || 'N/A',
            toolId: toolNodeId,
            label: intData.label
          }
        );

        this.log('debug', `Hitting Integration: ${intData.label}`, {
          type: intData.integrationType,
          url: intData.url,
          method: intData.method || 'GET'
        });

        // UI callbacks for highlighting
        if (this.options.onSetActiveNodes) {
          this.options.onSetActiveNodes([toolNodeId, integrationNode.id]);
        }
        if (this.options.onUpdateNodeUsage) {
          this.options.onUpdateNodeUsage(integrationNode.id);
        }

        // Execute integration via IntegrationExecutor
        const integrationResult = await this.integrationExecutor.execute(
          intData,
          args,
          {
            timeout: options?.timeout || this.options.timeout || 10000,
            enableRetry: this.options.retry?.enabled !== false,
            traceContext: integrationTraceContext ? {
              spanId: integrationTraceContext.spanId,
              tracer: this.tracer!
            } : undefined
          }
        );

        const duration = Date.now() - startTime;

        // Log raw result
        this.log('debug', `Tool Raw Result (Before Normalization)`, {
          toolNodeId,
          integrationNodeId: integrationNode.id,
          rawResult: integrationResult,
          hasData: !!integrationResult.data,
          hasError: !!integrationResult.error
        });

        // Normalize response
        const normalized = normalizeSubAgentResponse(
          {
            status: integrationResult.success ? 'success' : 'error',
            source: integrationResult.source,
            data: integrationResult.data,
            error: integrationResult.error,
            errorCode: integrationResult.errorCode
          },
          'direct',
          { duration }
        );

        // Log normalized result
        const dataKeys = normalized.data && typeof normalized.data === 'object' && !Array.isArray(normalized.data)
          ? Object.keys(normalized.data)
          : [];

        this.log('debug', `Tool Execution Complete (After Normalization)`, {
          toolNodeId,
          integrationNodeId: integrationNode.id,
          success: normalized.success,
          duration,
          hasData: !!normalized.data,
          dataKeys
        });

        if (!normalized.success) {
          if (this.options.onSetNodeError) {
            this.options.onSetNodeError(toolNodeId, normalized.error || 'Tool execution failed');
          }
          
          return {
            success: false,
            error: normalized.error,
            errorCode: normalized.errorCode,
            metadata: { duration }
          };
        }

        // Flatten response structure for AI - ensure data is easily accessible
        const responseData = normalized.data;
        const actualData = responseData?.data || responseData;

        // Generate summary and structure hints for AI
        const dataSummary = actualData ? this.generateDataSummary(actualData) : 'No data';
        const dataStructure = actualData ? this.describeDataStructure(actualData) : 'empty';

        // Log success
        if (this.options.onLog) {
          this.options.onLog('system', `✅ Tool Execution Complete: Retrieved ${dataKeys.length > 0 ? `${dataKeys.length} fields` : 'data'} in ${duration}ms`);
        }

        return {
          success: true,
          data: actualData,  // Flattened data at top level
          summary: dataSummary,  // Human-readable summary
          structure: dataStructure,  // Structure description
          metadata: {
            source: responseData?.source || integrationResult.source || 'tool',
            duration,
            ...(responseData?.metadata || {})
          }
        };
      }

      // Fallback: If no integration node, return a generic success
      // This ensures the chain doesn't break even if the user didn't wire up an integration node.
      const duration = Date.now() - startTime;
      this.log('debug', `Tool executed without integration node`, {
        toolNodeId,
        duration
      });

      return {
        success: true,
        data: {
          message: "Tool executed (Internal Mock)",
          details: "Connect an Integration Node to this Tool Agent to fetch real data.",
          input_args: args
        },
        summary: "Tool executed without integration",
        structure: "object with message and details",
        metadata: { duration, source: 'internal' }
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMsg = error.message || 'Unknown error occurred during tool execution';
      const errorCode = error.message?.includes('timeout') ? 'TOOL_TIMEOUT' : 'TOOL_EXECUTION_ERROR';

      this.log('debug', 'Tool Execution Error', {
        toolNodeId,
        error: errorMsg,
        errorCode,
        stack: error.stack,
        duration
      });

      if (this.options.onSetNodeError) {
        this.options.onSetNodeError(toolNodeId, errorMsg);
      }

      return {
        success: false,
        error: errorMsg,
        errorCode,
        metadata: { duration }
      };
    }
  }

  /**
   * Helper function to generate a summary of data structure for AI
   */
  private generateDataSummary(data: any, depth: number = 0, maxDepth: number = 2): string {
    if (depth > maxDepth) return '...';
    if (data === null || data === undefined) return 'null';
    if (typeof data === 'string') return `"${data.substring(0, 50)}${data.length > 50 ? '...' : ''}"`;
    if (typeof data === 'number' || typeof data === 'boolean') return String(data);
    if (Array.isArray(data)) {
      if (data.length === 0) return '[]';
      return `[${data.length} items: ${this.generateDataSummary(data[0], depth + 1, maxDepth)}]`;
    }
    if (typeof data === 'object') {
      const keys = Object.keys(data);
      if (keys.length === 0) return '{}';
      const preview = keys.slice(0, 5).map(k => `${k}: ${this.generateDataSummary(data[k], depth + 1, maxDepth)}`).join(', ');
      return keys.length > 5 ? `{${preview}, ...}` : `{${preview}}`;
    }
    return String(data);
  }

  /**
   * Helper function to describe data structure
   */
  private describeDataStructure(data: any): string {
    if (data === null || data === undefined) return 'null';
    if (typeof data !== 'object') return typeof data;
    if (Array.isArray(data)) {
      return `array[${data.length}]${data.length > 0 ? ` of ${this.describeDataStructure(data[0])}` : ''}`;
    }
    const keys = Object.keys(data);
    return `object with fields: ${keys.join(', ')}`;
  }

  /**
   * Log helper
   */
  private log(level: 'debug' | 'system', text: string, details?: any): void {
    if (this.options.onLog) {
      this.options.onLog(level, text, details);
    }
    if (this.logger) {
      if (level === 'debug') {
        this.logger.debug(text, details);
      } else {
        this.logger.info(text, details);
      }
    }
  }
}

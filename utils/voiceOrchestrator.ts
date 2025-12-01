/**
 * Voice Orchestrator
 * 
 * Wrapper around SystemOrchestrator that adds voice capabilities using GeminiClient.
 * Provides a unified interface for voice-enabled orchestration while leveraging
 * the structured orchestration capabilities of SystemOrchestrator.
 * 
 * Architecture:
 * - Uses GeminiClient for voice I/O (audio streaming, transcription)
 * - Uses SystemOrchestrator for agent coordination and tool execution
 * - Bridges voice layer with orchestration layer
 */

import { SystemOrchestrator, SystemConfig } from './systemOrchestrator';
import { GeminiClient, GeminiConfig, ToolCallResponse } from './geminiClient';
import { CentralLogger } from './logger';
import { AppNode, Edge, RouterNodeData, NodeType } from '../types';

/**
 * Voice Orchestrator options
 */
export interface VoiceOrchestratorOptions {
  apiKey: string;
  logger?: CentralLogger;
  // Voice-specific callbacks
  onTranscription?: (text: string, role: 'user' | 'model', isFinal: boolean) => void;
  onAudioData?: (audioData: ArrayBuffer) => void;
  // UI callbacks (for TestPanel integration)
  onSetActiveNodes?: (nodeIds: string[]) => void;
  onSetNodeError?: (nodeId: string, error: string) => void;
  onLog?: (level: 'debug' | 'system', text: string, details?: any) => void;
}

/**
 * Voice Orchestrator
 * 
 * Combines voice capabilities with structured orchestration
 */
export class VoiceOrchestrator {
  private systemOrchestrator: SystemOrchestrator;
  private geminiClient: GeminiClient | null = null;
  private logger: CentralLogger;
  private options: VoiceOrchestratorOptions;
  private isVoiceSessionActive: boolean = false;
  
  // Store nodes and edges for tool generation
  private nodes: AppNode[] = [];
  private edges: Edge[] = [];

  constructor(
    systemConfig: SystemConfig,
    options: VoiceOrchestratorOptions
  ) {
    this.options = options;
    this.logger = options.logger || new CentralLogger('info');
    
    // Initialize SystemOrchestrator
    this.systemOrchestrator = new SystemOrchestrator(systemConfig);
  }

  /**
   * Update nodes and edges (needed for tool generation)
   */
  updateNodesAndEdges(nodes: AppNode[], edges: Edge[]): void {
    this.nodes = nodes;
    this.edges = edges;
  }

  /**
   * Initialize the orchestrator
   */
  async initialize(): Promise<void> {
    await this.systemOrchestrator.initialize();
    this.logger.info('VoiceOrchestrator initialized');
  }

  /**
   * Start a voice session
   * 
   * @param agentNodeId - ID of the router/master agent node
   * @param tools - Tools to provide to the Gemini client
   */
  async startVoiceSession(
    agentNodeId: string,
    tools: any[] = []
  ): Promise<void> {
    if (this.isVoiceSessionActive) {
      this.logger.warn('Voice session already active');
      return;
    }

    // Find router node for configuration
    const routerNode = this.nodes.find(n => n.id === agentNodeId && n.type === NodeType.ROUTER);
    if (!routerNode) {
      throw new Error(`Router node not found: ${agentNodeId}`);
    }

    const routerData = routerNode.data as RouterNodeData;
    
    // Build system prompt
    const HUMAN_PROMPT = `
VOICE STYLE GUIDELINES:
1.  **Sound Natural**: Do not sound like a robot.
2.  **Pacing**: Vary your speaking speed.
3.  **Filler Words**: Naturally use filler words (like "um", "uh") to simulate thinking.
4.  **Intonation**: Use pitch changes to express empathy or curiosity.
5.  **Brevity**: Speak in concise, conversational bursts.
6.  **Sole Speaker**: You are the ONLY agent the user speaks to. You must never transfer the user. You consult your tools silently and then relay the answer.
`;

    const systemPrompt = `${HUMAN_PROMPT}\n\n${routerData.systemPrompt || "You are a helpful assistant."}`;

    // Create GeminiClient configuration
    const geminiConfig: GeminiConfig = {
      apiKey: this.options.apiKey,
      voiceName: routerData.voiceId || 'Zephyr',
      systemInstruction: systemPrompt,
      tools: tools
    };

    this.geminiClient = new GeminiClient(geminiConfig);

    // Set up callbacks
    if (this.options.onTranscription) {
      this.geminiClient.onTranscription = this.options.onTranscription;
    }

    if (this.options.onAudioData) {
      this.geminiClient.onAudioData = this.options.onAudioData;
    }

    // Set up tool call handler
    this.geminiClient.onToolCall = async (toolCalls: any[]): Promise<ToolCallResponse[]> => {
      return await this.handleToolCalls(toolCalls);
    };

    // Connect to Gemini Live
    await this.geminiClient.connect();
    this.isVoiceSessionActive = true;
    this.logger.info('Voice session started');
  }

  /**
   * Stop the voice session
   */
  async stopVoiceSession(): Promise<void> {
    if (!this.isVoiceSessionActive || !this.geminiClient) {
      return;
    }

    await this.geminiClient.disconnect();
    this.geminiClient.stopRecording();
    this.geminiClient = null;
    this.isVoiceSessionActive = false;
    this.logger.info('Voice session stopped');
  }

  /**
   * Start recording audio input
   */
  async startRecording(): Promise<void> {
    if (!this.geminiClient) {
      throw new Error('Voice session not started. Call startVoiceSession first.');
    }
    await this.geminiClient.startRecording();
  }

  /**
   * Stop recording audio input
   */
  stopRecording(): void {
    if (this.geminiClient) {
      this.geminiClient.stopRecording();
    }
  }

  /**
   * Send text to trigger voice response
   */
  async sendText(text: string): Promise<void> {
    if (!this.geminiClient) {
      throw new Error('Voice session not started. Call startVoiceSession first.');
    }
    await this.geminiClient.sendText(text);
  }

  /**
   * Handle tool calls from Gemini
   * 
   * This bridges Gemini's tool calls to SystemOrchestrator's processing
   * For now, this is a placeholder - full implementation would delegate to
   * SystemOrchestrator's tool execution mechanism or use TestPanel's pattern
   */
  private async handleToolCalls(toolCalls: any[]): Promise<ToolCallResponse[]> {
    const results: ToolCallResponse[] = [];

    for (const toolCall of toolCalls) {
      try {
        // TODO: Delegate tool execution to SystemOrchestrator or use TestPanel pattern
        // For now, return a placeholder response
        this.log('debug', `Tool call received: ${toolCall.name}`, {
          toolCallId: toolCall.id,
          args: toolCall.args
        });

        // Placeholder: In full implementation, this would:
        // 1. Map tool name to node ID
        // 2. Execute via SystemOrchestrator or TestPanel pattern
        // 3. Return normalized response

        results.push({
          id: toolCall.id,
          result: {
            success: true,
            message: `Tool ${toolCall.name} executed (placeholder)`,
            data: {}
          }
        });
      } catch (error: any) {
        this.log('debug', `Tool call error: ${toolCall.name}`, {
          toolCallId: toolCall.id,
          error: error.message
        });

        results.push({
          id: toolCall.id,
          result: {
            success: false,
            error: error.message || 'Tool execution failed',
            errorCode: 'TOOL_EXECUTION_ERROR'
          }
        });
      }
    }

    return results;
  }

  /**
   * Get SystemOrchestrator instance (for advanced usage)
   */
  getSystemOrchestrator(): SystemOrchestrator {
    return this.systemOrchestrator;
  }

  /**
   * Get GeminiClient instance (for advanced usage)
   */
  getGeminiClient(): GeminiClient | null {
    return this.geminiClient;
  }

  /**
   * Check if voice session is active
   */
  isSessionActive(): boolean {
    return this.isVoiceSessionActive;
  }

  /**
   * Process caller input (text-based, delegates to SystemOrchestrator)
   * 
   * This provides a text-based interface for testing/debugging
   */
  async processCallerInput(
    callerInput: string,
    sessionId: string,
    userId?: string
  ): Promise<string> {
    return await this.systemOrchestrator.processCallerInput(callerInput, sessionId, userId);
  }

  /**
   * Shutdown orchestrator
   */
  async shutdown(): Promise<void> {
    await this.stopVoiceSession();
    await this.systemOrchestrator.shutdown();
    this.logger.info('VoiceOrchestrator shut down');
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

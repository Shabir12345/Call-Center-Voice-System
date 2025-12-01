/**
 * TestPanel Adapter
 * 
 * Adapter to integrate the new Master-Sub-Agent architecture
 * with the existing TestPanel component.
 */

import { SystemOrchestrator, SystemConfig } from './systemOrchestrator';
import { VoiceOrchestrator, VoiceOrchestratorOptions } from './voiceOrchestrator';
import { ToolExecutor, ToolExecutorOptions } from './toolExecutor';
import { AppNode, Edge, RouterNodeData, DepartmentNodeData, SubAgentNodeData, NodeType } from '../types';
import { MasterAgentConfig } from './masterAgent';
import { SubAgentConfig } from './subAgentModule';
import { CentralLogger } from './logger';
import { AppVariantManager, AppConfig } from './appVariant';
import { Tracer } from './tracing';

/**
 * Callbacks for visual feedback and real-time updates
 */
export interface TestPanelCallbacks {
  onSystemMessage?: (message: string) => void;
  onAgentActive?: (agentId: string) => void;
  onEdgeAnimate?: (source: string, target: string) => void;
  // Enhanced UI callbacks for Integration Nodes
  onSetActiveNodes?: (nodeIds: string[]) => void;
  onSetNodeError?: (nodeId: string, error: string) => void;
  onUpdateNodeUsage?: (nodeId: string) => void;
  onLog?: (level: 'debug' | 'system', text: string, details?: any) => void;
}

/**
 * Adapter to bridge TestPanel with new architecture
 */
export class TestPanelAdapter {
  private orchestrator: SystemOrchestrator | null = null;
  private voiceOrchestrator: VoiceOrchestrator | null = null;
  private toolExecutor: ToolExecutor | null = null;
  private logger: CentralLogger;
  private tracer: Tracer;
  private appVariantManager: AppVariantManager;
  private currentAppVariant: string | null = null;
  private callbacks: TestPanelCallbacks = {};
  private nodes: AppNode[] = [];
  private edges: Edge[] = [];
  private mode: 'text' | 'voice' = 'text';

  constructor() {
    this.logger = new CentralLogger('info');
    this.tracer = new Tracer(this.logger);
    this.appVariantManager = new AppVariantManager();
  }

  /**
   * Load app variant template
   */
  async loadAppVariant(templateId: string, customizations?: any): Promise<void> {
    try {
      // Load template JSON files - try fetch first, fallback to direct import
      const templateMap: Record<string, string> = {
        'hospitality_hotel_v1': '/templates/hospitality.json',
        'travel_airline_v1': '/templates/travel.json',
        'ecommerce_support_v1': '/templates/ecommerce.json'
      };

      const templatePath = templateMap[templateId];
      if (!templatePath) {
        throw new Error(`Template not found: ${templateId}`);
      }

      let template: any;
      
      // Try to fetch from public folder (works in dev and production)
      try {
        const response = await fetch(templatePath);
        if (!response.ok) {
          throw new Error(`Failed to fetch template: ${response.statusText}`);
        }
        template = await response.json();
      } catch (fetchError) {
        // Fallback: try importing directly (works in build)
        try {
          // Dynamic import based on template ID
          if (templateId === 'hospitality_hotel_v1') {
            template = await import('../templates/hospitality.json');
          } else if (templateId === 'travel_airline_v1') {
            template = await import('../templates/travel.json');
          } else if (templateId === 'ecommerce_support_v1') {
            template = await import('../templates/ecommerce.json');
          } else {
            throw new Error(`Unknown template: ${templateId}`);
          }
          // Handle default export from JSON import
          template = template.default || template;
        } catch (importError) {
          this.logger.error('Failed to load template via fetch and import', { fetchError, importError, templateId });
          throw new Error(`Failed to load template ${templateId}. Please ensure templates are available.`);
        }
      }
      
      // Register and load variant
      this.appVariantManager.loadTemplateFromJSON(template);
      const appConfig = this.appVariantManager.loadVariant(templateId, customizations);
      
      this.currentAppVariant = templateId;
      this.logger.info('App variant loaded', { templateId, variantName: appConfig.variantName });
    } catch (error: any) {
      this.logger.error('Failed to load app variant', error);
      throw error;
    }
  }

  /**
   * Get current app variant
   */
  getCurrentAppVariant(): string | null {
    return this.currentAppVariant;
  }

  /**
   * Get available app variants
   */
  getAvailableVariants(): Array<{ id: string; name: string; description: string }> {
    return [
      { id: 'hospitality_hotel_v1', name: 'Hotel Management', description: 'Reservations and concierge services' },
      { id: 'travel_airline_v1', name: 'Airline Booking', description: 'Flight booking and travel services' },
      { id: 'ecommerce_support_v1', name: 'E-Commerce Support', description: 'Order management and customer service' }
    ];
  }

  /**
   * Initialize from TestPanel nodes (with optional app variant and callbacks)
   */
  async initializeFromNodes(
    nodes: AppNode[],
    appVariantId?: string,
    callbacks?: TestPanelCallbacks,
    edges?: Edge[],
    mode: 'text' | 'voice' = 'text',
    apiKey?: string
  ): Promise<void> {
    // Store callbacks, nodes, and edges
    if (callbacks) {
      this.callbacks = callbacks;
    }
    this.nodes = nodes;
    this.edges = edges || [];
    this.mode = mode;
    // Find router node (master agent)
    const routerNode = nodes.find(node => node.type === NodeType.ROUTER);
    if (!routerNode) {
      throw new Error('No Router node found');
    }

    const routerData = routerNode.data as RouterNodeData;

    // If app variant is specified, load it and merge with node config
    let appConfig: AppConfig | null = null;
    if (appVariantId) {
      try {
        await this.loadAppVariant(appVariantId);
        appConfig = this.appVariantManager.loadVariant(appVariantId);
        this.currentAppVariant = appVariantId;
      } catch (error) {
        this.logger.warn('Failed to load app variant, using node config', { error, appVariantId });
      }
    }

    // Find department nodes (sub-agents)
    const departmentNodes = nodes.filter(node => node.type === NodeType.DEPARTMENT);
    const subAgentNodes = nodes.filter(node => node.type === NodeType.SUB_AGENT);

    // Enhance callbacks to include agent name lookup
    const enhancedCallbacks = { ...this.callbacks };
    if (enhancedCallbacks.onSystemMessage) {
      const originalOnSystemMessage = enhancedCallbacks.onSystemMessage;
      enhancedCallbacks.onSystemMessage = (message: string) => {
        // If message contains agent ID, try to replace with agent name
        const match = message.match(/Consulting (\w+)/);
        if (match) {
          const agentId = match[1];
          const agentNode = this.nodes.find(n => n.id === agentId);
          if (agentNode) {
            const agentName = (agentNode.data as DepartmentNodeData | SubAgentNodeData).agentName || 
                            (agentNode.data as DepartmentNodeData).name ||
                            agentNode.data.label ||
                            agentNode.id;
            message = message.replace(/Consulting \w+/, `Consulting ${agentName}`);
          }
        }
        originalOnSystemMessage(message);
      };
    }

    // Build master agent config (merge app variant with node config)
    const masterAgentConfig: MasterAgentConfig = {
      ...(appConfig?.masterAgentConfig || {}),
      agentId: routerNode.id,
      systemPrompt: routerData.systemPrompt || appConfig?.masterAgentConfig?.systemPrompt || 'You are a helpful assistant.',
      voiceSettings: routerData.voiceSettings || appConfig?.masterAgentConfig?.voiceSettings,
      intents: routerData.intents || appConfig?.masterAgentConfig?.intents || [],
      guardrails: routerData.guardrails || appConfig?.masterAgentConfig?.guardrails,
      bidirectionalEnabled: routerData.bidirectionalEnabled || appConfig?.masterAgentConfig?.bidirectionalEnabled || false,
      communicationTimeout: routerData.communicationTimeout || appConfig?.masterAgentConfig?.communicationTimeout || 30000,
      // Add enhanced callbacks for visual feedback
      onSystemMessage: enhancedCallbacks.onSystemMessage,
      onAgentActive: enhancedCallbacks.onAgentActive,
      onEdgeAnimate: enhancedCallbacks.onEdgeAnimate
    };

    // Merge system prompt if app variant provides one
    if (appConfig?.masterAgentConfig?.systemPrompt && routerData.systemPrompt) {
      masterAgentConfig.systemPrompt = `${appConfig.masterAgentConfig.systemPrompt}\n\n${routerData.systemPrompt}`;
    } else if (appConfig?.masterAgentConfig?.systemPrompt) {
      masterAgentConfig.systemPrompt = appConfig.masterAgentConfig.systemPrompt;
    }

    // Build sub-agent configs (use app variant configs if available, otherwise use nodes)
    const subAgentConfigs: SubAgentConfig[] = [];

    // If app variant provides sub-agents, use them; otherwise use nodes
    if (appConfig && appConfig.subAgentConfigs.length > 0) {
      // Use app variant sub-agents, but merge with node-based configs if needed
      subAgentConfigs.push(...appConfig.subAgentConfigs);
    } else {
      // Add department nodes as sub-agents
      for (const deptNode of departmentNodes) {
        const deptData = deptNode.data as DepartmentNodeData;
        subAgentConfigs.push({
          agentId: deptNode.id,
          specialty: deptData.name || deptNode.id,
          systemPrompt: deptData.systemPrompt || `You are a ${deptData.name} specialist.`,
          model: deptData.model || 'pro',
          tasks: deptData.tools || [],
          tools: deptData.tools || [],
          bidirectionalEnabled: routerData.bidirectionalEnabled || false,
          maxConversationDepth: routerData.maxConversationDepth || 5
        });
      }

      // Add sub-agent nodes as tool agents
      for (const subAgentNode of subAgentNodes) {
        const subAgentData = subAgentNode.data as SubAgentNodeData;
        subAgentConfigs.push({
          agentId: subAgentNode.id,
          specialty: subAgentData.functionName || subAgentNode.id,
          systemPrompt: subAgentData.description || `Tool: ${subAgentData.functionName}`,
          model: 'flash', // Tool agents are typically fast
          tasks: [subAgentData.functionName || 'execute'],
          tools: [subAgentData.functionName || 'execute']
        });
      }
    }

    // Create orchestrator config (merge app variant config if available)
    const orchestratorConfig: SystemConfig = {
      masterAgent: masterAgentConfig,
      subAgents: subAgentConfigs,
      communication: appConfig?.communicationConfig || {
        enabled: routerData.bidirectionalEnabled || false,
        maxConversationDepth: routerData.maxConversationDepth || 5,
        timeout: routerData.communicationTimeout || 30000,
        retryEnabled: true,
        maxRetries: 2
      },
      stateManagement: appConfig?.stateManagement || {
        storageType: 'session'
      },
      logging: {
        level: 'info',
        maxLogs: 10000
      },
      appVariant: appVariantId || undefined,
      appVariantCustomizations: appConfig?.businessRules
    };

    // Create orchestrator based on mode
    if (mode === 'voice' && apiKey) {
      // Create VoiceOrchestrator for voice mode
      const voiceOptions: VoiceOrchestratorOptions = {
        apiKey,
        logger: this.logger,
        onTranscription: callbacks?.onLog ? (text, role, isFinal) => {
          callbacks.onLog?.('system', `${role}: ${text}`, { isFinal });
        } : undefined,
        onSetActiveNodes: callbacks?.onSetActiveNodes,
        onSetNodeError: callbacks?.onSetNodeError,
        onLog: callbacks?.onLog
      };

      this.voiceOrchestrator = new VoiceOrchestrator(orchestratorConfig, voiceOptions);
      this.voiceOrchestrator.updateNodesAndEdges(this.nodes, this.edges);
      await this.voiceOrchestrator.initialize();
    } else {
      // Create SystemOrchestrator for text mode
      this.orchestrator = new SystemOrchestrator(orchestratorConfig);
      await this.orchestrator.initialize();
    }

    // Initialize ToolExecutor for Integration Node support
    const toolExecutorOptions: ToolExecutorOptions = {
      timeout: routerData.communicationTimeout || 10000,
      retry: {
        enabled: true,
        maxRetries: 3,
        initialDelay: 1000,
        maxDelay: 10000
      },
      logger: this.logger,
      tracer: this.tracer,
      onSetActiveNodes: callbacks?.onSetActiveNodes,
      onSetNodeError: callbacks?.onSetNodeError,
      onUpdateNodeUsage: callbacks?.onUpdateNodeUsage,
      onLog: callbacks?.onLog
    };

    this.toolExecutor = new ToolExecutor(this.nodes, this.edges, toolExecutorOptions);

    this.logger.info('TestPanel adapter initialized', {
      masterAgent: routerNode.id,
      subAgents: subAgentConfigs.length,
      mode,
      hasToolExecutor: !!this.toolExecutor
    });
  }

  /**
   * Process caller input (compatible with TestPanel interface)
   */
  async processCallerInput(
    callerInput: string,
    sessionId: string,
    userId?: string
  ): Promise<string> {
    if (this.voiceOrchestrator) {
      // Use VoiceOrchestrator for text-based processing (fallback)
      return await this.voiceOrchestrator.processCallerInput(callerInput, sessionId, userId);
    }

    if (!this.orchestrator) {
      throw new Error('Orchestrator not initialized. Call initializeFromNodes first.');
    }

    return await this.orchestrator.processCallerInput(callerInput, sessionId, userId);
  }

  /**
   * Execute a tool with Integration Node support
   * 
   * @param toolNodeId - ID of the tool agent node (SubAgentNode)
   * @param args - Arguments passed to the tool
   * @returns Tool execution result
   */
  async executeTool(toolNodeId: string, args: Record<string, any> = {}): Promise<any> {
    if (!this.toolExecutor) {
      throw new Error('ToolExecutor not initialized. Call initializeFromNodes first.');
    }

    return await this.toolExecutor.executeTool(toolNodeId, args);
  }

  /**
   * Update nodes and edges (for dynamic workflows)
   */
  updateNodesAndEdges(nodes: AppNode[], edges: Edge[]): void {
    this.nodes = nodes;
    this.edges = edges;
    
    if (this.toolExecutor) {
      this.toolExecutor.updateNodesAndEdges(nodes, edges);
    }
    
    if (this.voiceOrchestrator) {
      this.voiceOrchestrator.updateNodesAndEdges(nodes, edges);
    }
  }

  /**
   * Start voice session (for voice mode)
   */
  async startVoiceSession(agentNodeId: string, tools: any[] = []): Promise<void> {
    if (!this.voiceOrchestrator) {
      throw new Error('VoiceOrchestrator not initialized. Initialize with voice mode first.');
    }
    await this.voiceOrchestrator.startVoiceSession(agentNodeId, tools);
  }

  /**
   * Stop voice session
   */
  async stopVoiceSession(): Promise<void> {
    if (this.voiceOrchestrator) {
      await this.voiceOrchestrator.stopVoiceSession();
    }
  }

  /**
   * Get VoiceOrchestrator (for advanced voice usage)
   */
  getVoiceOrchestrator(): VoiceOrchestrator | null {
    return this.voiceOrchestrator;
  }

  /**
   * Get ToolExecutor (for advanced tool usage)
   */
  getToolExecutor(): ToolExecutor | null {
    return this.toolExecutor;
  }

  /**
   * Get orchestrator (for advanced usage)
   */
  getOrchestrator(): SystemOrchestrator | null {
    return this.orchestrator;
  }

  /**
   * Get logger
   */
  getLogger(): CentralLogger {
    return this.logger;
  }

  /**
   * Get system statistics
   */
  getStatistics() {
    if (!this.orchestrator) {
      return null;
    }
    return this.orchestrator.getStatistics();
  }

  /**
   * Shutdown
   */
  async shutdown(): Promise<void> {
    if (this.voiceOrchestrator) {
      await this.voiceOrchestrator.shutdown();
      this.voiceOrchestrator = null;
    }
    if (this.orchestrator) {
      await this.orchestrator.shutdown();
      this.orchestrator = null;
    }
    // ToolExecutor doesn't need shutdown (stateless)
    this.toolExecutor = null;
  }
}


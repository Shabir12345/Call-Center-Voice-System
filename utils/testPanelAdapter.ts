/**
 * TestPanel Adapter
 * 
 * Adapter to integrate the new Master-Sub-Agent architecture
 * with the existing TestPanel component.
 */

import { SystemOrchestrator, SystemConfig } from './systemOrchestrator';
import { AppNode, RouterNodeData, DepartmentNodeData, SubAgentNodeData } from '../types';
import { MasterAgentConfig } from './masterAgent';
import { SubAgentConfig } from './subAgentModule';
import { CentralLogger } from './logger';
import { AppVariantManager, AppConfig } from './appVariant';

/**
 * Adapter to bridge TestPanel with new architecture
 */
export class TestPanelAdapter {
  private orchestrator: SystemOrchestrator | null = null;
  private logger: CentralLogger;
  private appVariantManager: AppVariantManager;
  private currentAppVariant: string | null = null;

  constructor() {
    this.logger = new CentralLogger('info');
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
   * Initialize from TestPanel nodes (with optional app variant)
   */
  async initializeFromNodes(nodes: AppNode[], appVariantId?: string): Promise<void> {
    // Find router node (master agent)
    const routerNode = nodes.find(node => node.type === 'Router');
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
    const departmentNodes = nodes.filter(node => node.type === 'Department');
    const subAgentNodes = nodes.filter(node => node.type === 'Sub_Agent');

    // Build master agent config (merge app variant with node config)
    const masterAgentConfig: MasterAgentConfig = appConfig?.masterAgentConfig || {
      agentId: routerNode.id,
      systemPrompt: routerData.systemPrompt || 'You are a helpful assistant.',
      voiceSettings: routerData.voiceSettings || appConfig?.masterAgentConfig?.voiceSettings,
      intents: routerData.intents || appConfig?.masterAgentConfig?.intents || [],
      guardrails: routerData.guardrails || appConfig?.masterAgentConfig?.guardrails,
      bidirectionalEnabled: routerData.bidirectionalEnabled || appConfig?.masterAgentConfig?.bidirectionalEnabled || false,
      communicationTimeout: routerData.communicationTimeout || appConfig?.masterAgentConfig?.communicationTimeout || 30000
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

    // Create orchestrator
    this.orchestrator = new SystemOrchestrator(orchestratorConfig);

    await this.orchestrator.initialize();

    this.logger.info('TestPanel adapter initialized', {
      masterAgent: routerNode.id,
      subAgents: subAgentConfigs.length
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
    if (!this.orchestrator) {
      throw new Error('Orchestrator not initialized. Call initializeFromNodes first.');
    }

    return await this.orchestrator.processCallerInput(callerInput, sessionId, userId);
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
    if (this.orchestrator) {
      await this.orchestrator.shutdown();
      this.orchestrator = null;
    }
  }
}


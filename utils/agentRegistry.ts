/**
 * Agent Registry
 * 
 * Manages dynamic agent registration, discovery, and runtime addition.
 */

import { SubAgentModule, SubAgentConfig } from './subAgentModule';
import { CentralLogger } from './logger';
import { CommunicationManager } from './agentCommunication';

/**
 * Agent registry entry
 */
export interface AgentRegistryEntry {
  agentId: string;
  module: SubAgentModule;
  config: SubAgentConfig;
  registeredAt: number;
  status: 'active' | 'inactive' | 'error';
}

/**
 * Agent Registry for dynamic agent management
 */
export class AgentRegistry {
  private agents: Map<string, AgentRegistryEntry> = new Map();
  private communicationManager: CommunicationManager;
  private logger: CentralLogger;
  private moduleLoaders: Map<string, (config: SubAgentConfig, logger: CentralLogger) => SubAgentModule> = new Map();

  constructor(communicationManager: CommunicationManager, logger: CentralLogger) {
    this.communicationManager = communicationManager;
    this.logger = logger;
    this.registerDefaultLoaders();
  }

  /**
   * Register default module loaders
   */
  private registerDefaultLoaders(): void {
    // Register loaders for known agent types
    // These would import the actual modules
    // For now, we'll use a generic approach
  }

  /**
   * Register a module loader for a specific module type
   */
  registerModuleLoader(
    moduleType: string,
    loader: (config: SubAgentConfig, logger: CentralLogger) => SubAgentModule
  ): void {
    this.moduleLoaders.set(moduleType, loader);
  }

  /**
   * Register an agent
   */
  async registerAgent(
    config: SubAgentConfig,
    moduleClass?: new (config: SubAgentConfig, logger: CentralLogger) => SubAgentModule
  ): Promise<void> {
    try {
      // Check if agent already exists
      if (this.agents.has(config.agentId)) {
        throw new Error(`Agent ${config.agentId} is already registered`);
      }

      // Create agent module
      let module: SubAgentModule;
      if (moduleClass) {
        module = new moduleClass(config, this.logger);
      } else {
        // Try to load from registered loaders
        const loader = this.moduleLoaders.get(config.specialty);
        if (!loader) {
          throw new Error(`No loader found for module type: ${config.specialty}`);
        }
        module = loader(config, this.logger);
      }

      // Register with communication manager
      this.communicationManager.registerAgent(
        config.agentId,
        module.handleMessage.bind(module)
      );

      // Store in registry
      this.agents.set(config.agentId, {
        agentId: config.agentId,
        module,
        config,
        registeredAt: Date.now(),
        status: 'active'
      });

      this.logger.info(`Agent ${config.agentId} registered successfully`, {
        specialty: config.specialty,
        agentId: config.agentId
      });

    } catch (error: any) {
      this.logger.error(`Failed to register agent ${config.agentId}`, error);
      throw error;
    }
  }

  /**
   * Unregister an agent
   */
  unregisterAgent(agentId: string): void {
    const entry = this.agents.get(agentId);
    if (!entry) {
      return;
    }

    // Unregister from communication manager
    this.communicationManager.unregisterAgent(agentId);

    // Remove from registry
    this.agents.delete(agentId);

    this.logger.info(`Agent ${agentId} unregistered`);
  }

  /**
   * Get agent by ID
   */
  getAgent(agentId: string): AgentRegistryEntry | null {
    return this.agents.get(agentId) || null;
  }

  /**
   * Get all registered agents
   */
  getAllAgents(): AgentRegistryEntry[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents by specialty
   */
  getAgentsBySpecialty(specialty: string): AgentRegistryEntry[] {
    return Array.from(this.agents.values()).filter(
      entry => entry.config.specialty === specialty
    );
  }

  /**
   * Get active agents
   */
  getActiveAgents(): AgentRegistryEntry[] {
    return Array.from(this.agents.values()).filter(
      entry => entry.status === 'active'
    );
  }

  /**
   * Discover agents (find agents that can handle a task)
   */
  discoverAgentsForTask(task: string): AgentRegistryEntry[] {
    return Array.from(this.agents.values()).filter(entry => {
      const tasks = entry.config.tools || [];
      return tasks.includes(task) || 
             entry.config.specialty.toLowerCase().includes(task.toLowerCase());
    });
  }

  /**
   * Update agent status
   */
  updateAgentStatus(agentId: string, status: 'active' | 'inactive' | 'error'): void {
    const entry = this.agents.get(agentId);
    if (entry) {
      entry.status = status;
      this.logger.info(`Agent ${agentId} status updated to ${status}`);
    }
  }

  /**
   * Add agent at runtime
   */
  async addAgentAtRuntime(
    config: SubAgentConfig,
    moduleClass?: new (config: SubAgentConfig, logger: CentralLogger) => SubAgentModule
  ): Promise<void> {
    await this.registerAgent(config, moduleClass);
  }

  /**
   * Get agent statistics
   */
  getStatistics(): {
    totalAgents: number;
    activeAgents: number;
    inactiveAgents: number;
    bySpecialty: Record<string, number>;
  } {
    const agents = Array.from(this.agents.values());
    const bySpecialty: Record<string, number> = {};

    for (const agent of agents) {
      const specialty = agent.config.specialty;
      bySpecialty[specialty] = (bySpecialty[specialty] || 0) + 1;
    }

    return {
      totalAgents: agents.length,
      activeAgents: agents.filter(a => a.status === 'active').length,
      inactiveAgents: agents.filter(a => a.status === 'inactive').length,
      bySpecialty
    };
  }
}


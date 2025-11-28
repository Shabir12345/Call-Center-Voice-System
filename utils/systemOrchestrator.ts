/**
 * System Orchestrator
 * 
 * Main orchestrator that initializes and coordinates all components
 * of the Master-Sub-Agent architecture system.
 */

import { CommunicationManager } from './agentCommunication';
import { StateManager } from './stateManager';
import { CentralLogger } from './logger';
import { MasterAgent, MasterAgentConfig } from './masterAgent';
import { AgentRegistry } from './agentRegistry';
import { UserProfileManager } from './userProfile';
import { AppVariantManager, AppConfig } from './appVariant';
import { SubAgentModule, SubAgentConfig } from './subAgentModule';
import { BidirectionalConfig } from '../types';

/**
 * System configuration
 */
export interface SystemConfig {
  communication?: Partial<BidirectionalConfig>;
  stateManagement?: {
    storageType?: 'ephemeral' | 'session' | 'long_term';
  };
  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    maxLogs?: number;
  };
  masterAgent: MasterAgentConfig;
  subAgents?: SubAgentConfig[];
  appVariant?: string; // Template ID to load
  appVariantCustomizations?: any;
}

/**
 * System Orchestrator
 * 
 * Main entry point for the Master-Sub-Agent architecture system
 */
export class SystemOrchestrator {
  private communicationManager: CommunicationManager;
  private stateManager: StateManager;
  private logger: CentralLogger;
  private masterAgent: MasterAgent;
  private agentRegistry: AgentRegistry;
  private userProfileManager: UserProfileManager;
  private appVariantManager: AppVariantManager;
  private config: SystemConfig;
  private initialized: boolean = false;

  constructor(config: SystemConfig) {
    this.config = config;

    // Initialize core components
    this.logger = new CentralLogger(
      config.logging?.level || 'info',
      config.logging?.maxLogs || 10000
    );

    this.communicationManager = new CommunicationManager(config.communication);
    this.stateManager = new StateManager(
      config.stateManagement?.storageType || 'session'
    );
    this.agentRegistry = new AgentRegistry(this.communicationManager, this.logger);
    this.userProfileManager = new UserProfileManager();
    this.appVariantManager = new AppVariantManager();

    // Initialize master agent
    this.masterAgent = new MasterAgent(
      config.masterAgent,
      this.communicationManager,
      this.stateManager,
      this.logger
    );
  }

  /**
   * Initialize the system
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      this.logger.warn('System already initialized');
      return;
    }

    try {
      this.logger.info('Initializing Master-Sub-Agent system...');

      // Load app variant if specified
      if (this.config.appVariant) {
        const appConfig = this.appVariantManager.loadVariant(
          this.config.appVariant,
          this.config.appVariantCustomizations
        );

        // Apply app config to system
        await this.applyAppConfig(appConfig);
      }

      // Register sub-agents if provided
      if (this.config.subAgents) {
        for (const subAgentConfig of this.config.subAgents) {
          // Note: In production, you would load the actual module class
          // For now, we'll register the config
          this.logger.info(`Sub-agent config loaded: ${subAgentConfig.agentId}`);
        }
      }

      this.initialized = true;
      this.logger.info('System initialized successfully');

    } catch (error: any) {
      this.logger.error('Failed to initialize system', error);
      throw error;
    }
  }

  /**
   * Apply app configuration
   */
  private async applyAppConfig(appConfig: AppConfig): Promise<void> {
    // Update master agent config if needed
    // Register sub-agents from config
    // Apply communication and state management settings

    this.logger.info(`Applied app variant: ${appConfig.variantName}`);
  }

  /**
   * Process caller input through the system
   */
  async processCallerInput(
    callerInput: string,
    sessionId: string,
    userId?: string
  ): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Get or create user profile
    if (userId) {
      const userProfile = await this.userProfileManager.getOrCreateProfile(userId);
      const session = await this.stateManager.getOrCreateSession(sessionId);
      
      // Apply user preferences to session
      userProfile.applyToContext(session.context);
      await this.stateManager.updateSession(sessionId, {
        metadata: {
          ...session.metadata,
          ...userProfile.preferences
        }
      });
    }

    // Process through master agent
    return await this.masterAgent.processCallerInput(callerInput, sessionId);
  }

  /**
   * Register a sub-agent
   */
  async registerSubAgent(
    config: SubAgentConfig,
    moduleClass?: new (config: SubAgentConfig, logger: CentralLogger) => SubAgentModule
  ): Promise<void> {
    await this.agentRegistry.registerAgent(config, moduleClass);
    
    // Register intent mapping in master agent
    // This would be done based on the sub-agent's tasks
    this.logger.info(`Sub-agent registered: ${config.agentId}`);
  }

  /**
   * Get system statistics
   */
  getStatistics(): {
    agents: any;
    sessions: number;
    logs: any;
  } {
    return {
      agents: this.agentRegistry.getStatistics(),
      sessions: this.stateManager.getActiveSessions().length,
      logs: this.logger.getStatistics()
    };
  }

  /**
   * Get communication manager
   */
  getCommunicationManager(): CommunicationManager {
    return this.communicationManager;
  }

  /**
   * Get state manager
   */
  getStateManager(): StateManager {
    return this.stateManager;
  }

  /**
   * Get logger
   */
  getLogger(): CentralLogger {
    return this.logger;
  }

  /**
   * Get master agent
   */
  getMasterAgent(): MasterAgent {
    return this.masterAgent;
  }

  /**
   * Get agent registry
   */
  getAgentRegistry(): AgentRegistry {
    return this.agentRegistry;
  }

  /**
   * Get user profile manager
   */
  getUserProfileManager(): UserProfileManager {
    return this.userProfileManager;
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down system...');
    
    // Cleanup sessions
    await this.stateManager.cleanupExpiredSessions();
    
    // Clear communication manager
    this.communicationManager.clear();
    
    this.initialized = false;
    this.logger.info('System shutdown complete');
  }
}


/**
 * App Variant System
 * 
 * Manages different app variants (hospitality, travel, e-commerce, etc.)
 * with template loading, validation, and customization.
 */

import { SubAgentConfig } from './subAgentModule';
import { MasterAgentConfig } from './masterAgent';

/**
 * Sub-agent configuration in template
 */
export interface TemplateSubAgentConfig {
  module: string;
  config: SubAgentConfig;
}

/**
 * Master agent configuration in template
 */
export interface TemplateMasterAgentConfig {
  agentId: string;
  systemPrompt: string;
  voiceSettings?: {
    speed?: number;
    tone?: string;
    language?: string;
    greeting?: string;
  };
  intents: string[];
  guardrails?: {
    bannedPhrases?: string[];
    fallbackResponse?: string;
  };
}

/**
 * App variant template structure
 */
export interface AppVariantTemplate {
  templateId: string;
  name: string;
  description: string;
  version: string;
  masterAgent: TemplateMasterAgentConfig;
  subAgents: TemplateSubAgentConfig[];
  communicationConfig?: {
    timeout?: {
      subAgentLoop?: number;
      toolExecution?: number;
    };
    retry?: {
      enabled?: boolean;
      maxRetries?: number;
      initialDelay?: number;
      maxDelay?: number;
    };
  };
  stateManagement?: {
    storageType?: 'ephemeral' | 'session' | 'long_term';
    sessionTimeout?: number;
    maxHistorySize?: number;
  };
}

/**
 * App configuration (loaded from template)
 */
export interface AppConfig {
  variantName: string;
  masterAgentConfig: MasterAgentConfig;
  subAgentConfigs: SubAgentConfig[];
  communicationConfig: any;
  stateManagement: any;
  businessRules: Record<string, any>;
}

/**
 * App Variant Manager
 */
export class AppVariantManager {
  private templates: Map<string, AppVariantTemplate> = new Map();
  private loadedConfigs: Map<string, AppConfig> = new Map();

  /**
   * Register a template
   */
  registerTemplate(template: AppVariantTemplate): void {
    this.templates.set(template.templateId, template);
  }

  /**
   * Load app variant from template
   */
  loadVariant(templateId: string, customizations?: Partial<AppVariantTemplate>): AppConfig {
    // Check cache
    if (this.loadedConfigs.has(templateId)) {
      return this.loadedConfigs.get(templateId)!;
    }

    // Get template
    let template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Apply customizations
    if (customizations) {
      template = this.mergeTemplate(template, customizations);
    }

    // Validate template
    this.validateTemplate(template);

    // Load business rules
    const businessRules = this.loadBusinessRules(template);

    // Convert template to app config
    const config: AppConfig = {
      variantName: template.name,
      masterAgentConfig: this.convertMasterAgentConfig(template.masterAgent),
      subAgentConfigs: template.subAgents.map(sa => sa.config),
      communicationConfig: template.communicationConfig || {},
      stateManagement: template.stateManagement || {},
      businessRules
    };

    // Cache config
    this.loadedConfigs.set(templateId, config);

    return config;
  }

  /**
   * Merge template with customizations
   */
  private mergeTemplate(
    template: AppVariantTemplate,
    customizations: Partial<AppVariantTemplate>
  ): AppVariantTemplate {
    return {
      ...template,
      ...customizations,
      masterAgent: {
        ...template.masterAgent,
        ...customizations.masterAgent
      },
      subAgents: customizations.subAgents || template.subAgents,
      communicationConfig: {
        ...template.communicationConfig,
        ...customizations.communicationConfig
      },
      stateManagement: {
        ...template.stateManagement,
        ...customizations.stateManagement
      }
    };
  }

  /**
   * Validate template structure
   */
  private validateTemplate(template: AppVariantTemplate): void {
    if (!template.templateId) {
      throw new Error('Template missing templateId');
    }

    if (!template.masterAgent) {
      throw new Error('Template missing masterAgent configuration');
    }

    if (!template.subAgents || template.subAgents.length === 0) {
      throw new Error('Template must have at least one sub-agent');
    }

    // Validate master agent config
    if (!template.masterAgent.agentId) {
      throw new Error('Master agent missing agentId');
    }

    if (!template.masterAgent.systemPrompt) {
      throw new Error('Master agent missing systemPrompt');
    }

    if (!template.masterAgent.intents || template.masterAgent.intents.length === 0) {
      throw new Error('Master agent must have at least one intent');
    }

    // Validate sub-agents
    for (const subAgent of template.subAgents) {
      if (!subAgent.config.agentId) {
        throw new Error('Sub-agent missing agentId');
      }

      if (!subAgent.config.specialty) {
        throw new Error('Sub-agent missing specialty');
      }
    }
  }

  /**
   * Convert template master agent config to MasterAgentConfig
   */
  private convertMasterAgentConfig(
    templateConfig: TemplateMasterAgentConfig
  ): MasterAgentConfig {
    return {
      agentId: templateConfig.agentId,
      systemPrompt: templateConfig.systemPrompt,
      voiceSettings: templateConfig.voiceSettings,
      intents: templateConfig.intents,
      guardrails: templateConfig.guardrails,
      bidirectionalEnabled: true,
      communicationTimeout: 30000
    };
  }

  /**
   * Load business rules from template
   */
  private loadBusinessRules(template: AppVariantTemplate): Record<string, any> {
    const businessRules: Record<string, any> = {};

    // Extract business rules from sub-agent configs
    for (const subAgent of template.subAgents) {
      if (subAgent.config.businessRules) {
        businessRules[subAgent.config.agentId] = subAgent.config.businessRules;
      }
    }

    return businessRules;
  }

  /**
   * Get available templates
   */
  getAvailableTemplates(): AppVariantTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): AppVariantTemplate | null {
    return this.templates.get(templateId) || null;
  }

  /**
   * Load template from JSON
   */
  loadTemplateFromJSON(json: string | object): AppVariantTemplate {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    this.validateTemplate(data);
    this.registerTemplate(data);
    return data;
  }
}

/**
 * Template loader utility
 */
export class TemplateLoader {
  /**
   * Load template from file or URL
   */
  static async loadTemplate(source: string | object): Promise<AppVariantTemplate> {
    let template: AppVariantTemplate;

    if (typeof source === 'object') {
      template = source as AppVariantTemplate;
    } else if (source.startsWith('http://') || source.startsWith('https://')) {
      // Load from URL
      const response = await fetch(source);
      template = await response.json();
    } else {
      // Load from file path (would need file system access)
      throw new Error('File system loading not implemented in browser environment');
    }

    return template;
  }

  /**
   * Load multiple templates
   */
  static async loadTemplates(sources: Array<string | object>): Promise<AppVariantTemplate[]> {
    return Promise.all(sources.map(source => this.loadTemplate(source)));
  }
}


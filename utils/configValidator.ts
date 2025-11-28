/**
 * Configuration Validator
 * 
 * Validates system configurations, templates, and agent configs
 * to ensure they are correct before deployment.
 */

import { AppVariantTemplate } from './appVariant';
import { MasterAgentConfig } from './masterAgent';
import { SubAgentConfig } from './subAgentModule';
import { RouterNodeData, DepartmentNodeData, SubAgentNodeData } from '../types';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Configuration Validator
 */
export class ConfigValidator {
  /**
   * Validate app variant template
   */
  validateTemplate(template: AppVariantTemplate): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate template structure
    if (!template.templateId) {
      errors.push('Template missing templateId');
    }

    if (!template.name) {
      errors.push('Template missing name');
    }

    if (!template.version) {
      warnings.push('Template missing version');
    }

    // Validate master agent
    if (!template.masterAgent) {
      errors.push('Template missing masterAgent configuration');
    } else {
      const masterValidation = this.validateMasterAgentConfig(template.masterAgent);
      errors.push(...masterValidation.errors);
      warnings.push(...masterValidation.warnings);
    }

    // Validate sub-agents
    if (!template.subAgents || template.subAgents.length === 0) {
      errors.push('Template must have at least one sub-agent');
    } else {
      for (const subAgent of template.subAgents) {
        if (!subAgent.config) {
          errors.push(`Sub-agent ${subAgent.module} missing config`);
        } else {
          const subValidation = this.validateSubAgentConfig(subAgent.config);
          errors.push(...subValidation.errors.map(e => `${subAgent.module}: ${e}`));
          warnings.push(...subValidation.warnings.map(w => `${subAgent.module}: ${w}`));
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate master agent config
   */
  validateMasterAgentConfig(config: MasterAgentConfig | any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.agentId) {
      errors.push('Master agent missing agentId');
    }

    if (!config.systemPrompt) {
      errors.push('Master agent missing systemPrompt');
    }

    if (!config.intents || config.intents.length === 0) {
      warnings.push('Master agent has no intents defined');
    }

    if (config.voiceSettings) {
      if (config.voiceSettings.speed && (config.voiceSettings.speed < 0.5 || config.voiceSettings.speed > 2.0)) {
        warnings.push('Voice speed should be between 0.5 and 2.0');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate sub-agent config
   */
  validateSubAgentConfig(config: SubAgentConfig | any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.agentId) {
      errors.push('Sub-agent missing agentId');
    }

    if (!config.specialty) {
      errors.push('Sub-agent missing specialty');
    }

    if (!config.systemPrompt) {
      warnings.push('Sub-agent missing systemPrompt');
    }

    if (config.model && !['flash', 'pro'].includes(config.model)) {
      warnings.push(`Sub-agent model should be 'flash' or 'pro', got: ${config.model}`);
    }

    if (config.maxConversationDepth && config.maxConversationDepth < 1) {
      errors.push('maxConversationDepth must be at least 1');
    }

    if (config.maxConversationDepth && config.maxConversationDepth > 10) {
      warnings.push('maxConversationDepth is very high, may cause performance issues');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate router node data
   */
  validateRouterNodeData(data: RouterNodeData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.systemPrompt) {
      errors.push('Router node missing systemPrompt');
    }

    if (!data.intents || data.intents.length === 0) {
      warnings.push('Router node has no intents defined');
    }

    if (data.communicationTimeout && data.communicationTimeout < 1000) {
      errors.push('communicationTimeout must be at least 1000ms');
    }

    if (data.maxConversationDepth && data.maxConversationDepth > 10) {
      warnings.push('maxConversationDepth is very high');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate department node data
   */
  validateDepartmentNodeData(data: DepartmentNodeData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.name) {
      errors.push('Department node missing name');
    }

    if (!data.systemPrompt) {
      warnings.push('Department node missing systemPrompt');
    }

    if (data.model && !['flash', 'pro'].includes(data.model)) {
      warnings.push(`Department model should be 'flash' or 'pro'`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate sub-agent node data
   */
  validateSubAgentNodeData(data: SubAgentNodeData): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!data.functionName) {
      errors.push('Sub-agent node missing functionName');
    }

    if (!data.description) {
      warnings.push('Sub-agent node missing description');
    }

    if (data.parameters && !Array.isArray(data.parameters)) {
      errors.push('Sub-agent parameters must be an array');
    }

    if (data.outputSchema) {
      try {
        JSON.parse(data.outputSchema);
      } catch (e) {
        errors.push('Sub-agent outputSchema must be valid JSON');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate complete system configuration
   */
  validateSystemConfig(config: {
    masterAgent?: MasterAgentConfig;
    subAgents?: SubAgentConfig[];
    [key: string]: any;
  }): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!config.masterAgent) {
      errors.push('System config missing masterAgent');
    } else {
      const masterValidation = this.validateMasterAgentConfig(config.masterAgent);
      errors.push(...masterValidation.errors);
      warnings.push(...masterValidation.warnings);
    }

    if (config.subAgents) {
      for (const subAgent of config.subAgents) {
        const subValidation = this.validateSubAgentConfig(subAgent);
        errors.push(...subValidation.errors);
        warnings.push(...subValidation.warnings);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate environment variables at startup
   */
  validateEnvironmentVariables(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Required environment variables
    const required = ['GEMINI_API_KEY'];
    const optional = ['LOG_LEVEL', 'MAX_LOGS', 'MAX_SESSIONS', 'SESSION_TIMEOUT_MS'];

    // Check required variables
    for (const key of required) {
      const value = process.env[key] || (typeof window !== 'undefined' ? (window as any).__ENV__?.[key] : undefined);
      if (!value || value.trim() === '') {
        errors.push(`Required environment variable ${key} is missing or empty`);
      } else if (key.includes('KEY') || key.includes('SECRET') || key.includes('PASSWORD')) {
        // Check if key looks like a placeholder
        if (value.includes('your_') || value.includes('placeholder') || value === 'your_key_here') {
          errors.push(`Environment variable ${key} appears to be a placeholder - please set a real value`);
        }
      }
    }

    // Check optional variables with defaults
    for (const key of optional) {
      const value = process.env[key];
      if (!value) {
        warnings.push(`Optional environment variable ${key} not set, using default`);
      }
    }

    // Validate LOG_LEVEL if set
    const logLevel = process.env.LOG_LEVEL;
    if (logLevel && !['debug', 'info', 'warn', 'error'].includes(logLevel.toLowerCase())) {
      warnings.push(`LOG_LEVEL should be one of: debug, info, warn, error. Got: ${logLevel}`);
    }

    // Validate numeric values
    const maxLogs = process.env.MAX_LOGS;
    if (maxLogs && (isNaN(Number(maxLogs)) || Number(maxLogs) < 0)) {
      errors.push(`MAX_LOGS must be a positive number, got: ${maxLogs}`);
    }

    const maxSessions = process.env.MAX_SESSIONS;
    if (maxSessions && (isNaN(Number(maxSessions)) || Number(maxSessions) < 0)) {
      errors.push(`MAX_SESSIONS must be a positive number, got: ${maxSessions}`);
    }

    // Security checks
    if (process.env.NODE_ENV === 'production') {
      // Check HTTPS in production
      if (typeof window !== 'undefined') {
        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
          errors.push('⚠️  Production must use HTTPS!');
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate and log configuration at startup
   */
  validateStartup(): boolean {
    const envValidation = this.validateEnvironmentVariables();
    
    if (!envValidation.valid) {
      console.error('❌ Configuration validation failed:');
      envValidation.errors.forEach(error => console.error(`  - ${error}`));
      if (envValidation.warnings.length > 0) {
        console.warn('⚠️  Configuration warnings:');
        envValidation.warnings.forEach(warning => console.warn(`  - ${warning}`));
      }
      return false;
    }

    if (envValidation.warnings.length > 0) {
      console.warn('⚠️  Configuration warnings:');
      envValidation.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }

    console.log('✅ Configuration validation passed');
    return true;
  }
}


/**
 * Migration Utilities
 * 
 * Utilities for migrating from old systems to new architecture
 */

import { AppNode, RouterNodeData, DepartmentNodeData, SubAgentNodeData } from '../types';
import { MasterAgentConfig } from './masterAgent';
import { SubAgentConfig } from './subAgentModule';
import { ConfigValidator } from './configValidator';

/**
 * Migration result
 */
export interface MigrationResult {
  success: boolean;
  warnings: string[];
  errors: string[];
  migratedConfig?: {
    masterAgent: MasterAgentConfig;
    subAgents: SubAgentConfig[];
  };
}

/**
 * Migration Utilities
 */
export class MigrationUtils {
  private validator: ConfigValidator;

  constructor() {
    this.validator = new ConfigValidator();
  }

  /**
   * Migrate nodes to new config format
   */
  migrateNodesToConfig(nodes: AppNode[]): MigrationResult {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Find router node
    const routerNode = nodes.find(n => n.type === 'Router');
    if (!routerNode) {
      return {
        success: false,
        errors: ['No Router node found'],
        warnings: []
      };
    }

    const routerData = routerNode.data as RouterNodeData;

    // Build master agent config
    const masterAgent: MasterAgentConfig = {
      agentId: routerNode.id,
      systemPrompt: routerData.systemPrompt || 'You are a helpful assistant.',
      voiceSettings: routerData.voiceSettings,
      intents: routerData.intents || [],
      guardrails: routerData.guardrails,
      bidirectionalEnabled: routerData.bidirectionalEnabled || false,
      communicationTimeout: routerData.communicationTimeout || 30000
    };

    // Validate master agent
    const masterValidation = this.validator.validateMasterAgentConfig(masterAgent);
    if (!masterValidation.valid) {
      errors.push(...masterValidation.errors);
    }
    warnings.push(...masterValidation.warnings);

    // Build sub-agent configs
    const subAgents: SubAgentConfig[] = [];
    
    // Department nodes
    const departmentNodes = nodes.filter(n => n.type === 'Department');
    for (const deptNode of departmentNodes) {
      const deptData = deptNode.data as DepartmentNodeData;
      const subAgent: SubAgentConfig = {
        agentId: deptNode.id,
        specialty: deptData.name || deptNode.id,
        systemPrompt: deptData.systemPrompt || `You are a ${deptData.name} specialist.`,
        model: deptData.model || 'pro',
        tasks: deptData.tools || [],
        tools: deptData.tools || [],
        bidirectionalEnabled: routerData.bidirectionalEnabled || false,
        maxConversationDepth: routerData.maxConversationDepth || 5
      };

      const subValidation = this.validator.validateSubAgentConfig(subAgent);
      if (!subValidation.valid) {
        errors.push(`${deptNode.id}: ${subValidation.errors.join(', ')}`);
      }
      warnings.push(...subValidation.warnings.map(w => `${deptNode.id}: ${w}`));

      subAgents.push(subAgent);
    }

    // Sub-agent nodes (tool agents)
    const subAgentNodes = nodes.filter(n => n.type === 'Sub_Agent');
    for (const subAgentNode of subAgentNodes) {
      const subAgentData = subAgentNode.data as SubAgentNodeData;
      const toolAgent: SubAgentConfig = {
        agentId: subAgentNode.id,
        specialty: subAgentData.functionName || subAgentNode.id,
        systemPrompt: subAgentData.description || `Tool: ${subAgentData.functionName}`,
        model: 'flash',
        tasks: [subAgentData.functionName || 'execute'],
        tools: [subAgentData.functionName || 'execute']
      };

      subAgents.push(toolAgent);
    }

    return {
      success: errors.length === 0,
      warnings,
      errors,
      migratedConfig: {
        masterAgent,
        subAgents
      }
    };
  }

  /**
   * Validate migration result
   */
  validateMigration(result: MigrationResult): boolean {
    if (!result.success) {
      return false;
    }

    if (!result.migratedConfig) {
      return false;
    }

    // Validate migrated config
    const validation = this.validator.validateSystemConfig(result.migratedConfig);
    return validation.valid;
  }

  /**
   * Generate migration report
   */
  generateMigrationReport(result: MigrationResult): string {
    let report = 'Migration Report\n';
    report += '================\n\n';

    report += `Status: ${result.success ? 'SUCCESS' : 'FAILED'}\n\n`;

    if (result.errors.length > 0) {
      report += 'Errors:\n';
      result.errors.forEach(err => report += `  - ${err}\n`);
      report += '\n';
    }

    if (result.warnings.length > 0) {
      report += 'Warnings:\n';
      result.warnings.forEach(warn => report += `  - ${warn}\n`);
      report += '\n';
    }

    if (result.migratedConfig) {
      report += 'Migrated Configuration:\n';
      report += `  Master Agent: ${result.migratedConfig.masterAgent.agentId}\n`;
      report += `  Sub-Agents: ${result.migratedConfig.subAgents.length}\n`;
    }

    return report;
  }
}


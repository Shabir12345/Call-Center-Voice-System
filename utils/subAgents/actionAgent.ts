/**
 * Action Agent Pattern
 * 
 * Base pattern for agents that perform actions (create, update, delete).
 */

import { SubAgentModule, SubAgentConfig, TaskResult } from '../subAgentModule';
import { ConversationContext } from '../../types';
import { CentralLogger } from '../logger';

/**
 * Action Agent - Pattern implementation
 */
export class ActionAgent extends SubAgentModule {
  protected actionHandler: any; // External action handler interface

  constructor(config: SubAgentConfig, logger: CentralLogger, actionHandler?: any) {
    super(config, logger);
    this.actionHandler = actionHandler || config.dataSource;
  }

  protected async processTask(
    task: string,
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<TaskResult> {
    // Pattern: Validate parameters, check permissions, perform action, confirm result
    const validation = this.validateActionParameters(parameters, task);
    if (!validation.valid) {
      return {
        status: 'needs_info',
        required: validation.required || []
      };
    }

    // Check permissions
    const permissionCheck = await this.checkPermissions(parameters, context);
    if (!permissionCheck.allowed) {
      return {
        status: 'error',
        error: {
          code: 'PERMISSION_DENIED',
          message: permissionCheck.reason || 'You do not have permission to perform this action',
          retryable: false
        }
      };
    }

    // Apply business rules
    const businessRulesCheck = this.applyBusinessRules(task, parameters);
    if (!businessRulesCheck.allowed) {
      return {
        status: 'error',
        error: {
          code: 'BUSINESS_RULE_VIOLATION',
          message: businessRulesCheck.reason || 'Action violates business rules',
          retryable: false
        }
      };
    }

    try {
      const result = await this.performAction(task, parameters, context);
      
      return {
        status: 'success',
        data: {
          action: task,
          result: result
        },
        metadata: {
          source: 'direct',
          confidence: 1.0
        }
      };
    } catch (error: any) {
      return {
        status: 'error',
        error: {
          code: 'ACTION_FAILED',
          message: error.message || 'Failed to perform action',
          retryable: this.isRetryableError(error)
        }
      };
    }
  }

  /**
   * Validate action parameters - to be implemented by subclasses
   */
  protected validateActionParameters(
    parameters: Record<string, any>,
    task: string
  ): { valid: boolean; required?: Array<any> } {
    return { valid: true };
  }

  /**
   * Check permissions - to be implemented by subclasses
   */
  protected async checkPermissions(
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Default: allow if caller_id is present
    return { allowed: !!context.callerId };
  }

  /**
   * Perform action - to be implemented by subclasses
   */
  protected async performAction(
    task: string,
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<any> {
    throw new Error('performAction must be implemented by subclass');
  }

  /**
   * Check if error is retryable
   */
  protected isRetryableError(error: any): boolean {
    const retryablePatterns = [
      'timeout',
      'network',
      'temporary',
      '503',
      '502',
      '504'
    ];

    const errorMessage = error.message || error.toString() || '';
    return retryablePatterns.some(pattern => 
      errorMessage.toLowerCase().includes(pattern.toLowerCase())
    );
  }
}


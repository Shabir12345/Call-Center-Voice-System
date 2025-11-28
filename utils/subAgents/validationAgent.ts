/**
 * Validation Agent Pattern
 * 
 * Base pattern for agents that validate data, check permissions, verify information.
 */

import { SubAgentModule, SubAgentConfig, TaskResult } from '../subAgentModule';
import { ConversationContext } from '../../types';
import { CentralLogger } from '../logger';

/**
 * Validation Agent - Pattern implementation
 */
export class ValidationAgent extends SubAgentModule {
  protected validationRules: Record<string, any> = {};

  constructor(config: SubAgentConfig, logger: CentralLogger) {
    super(config, logger);
    if (config.businessRules) {
      this.validationRules = config.businessRules;
    }
  }

  protected async processTask(
    task: string,
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<TaskResult> {
    // Pattern: Validate input, perform validation checks, return validation result
    const validation = this.validateInput(parameters, task);
    if (!validation.isValid) {
      return {
        status: 'needs_info',
        required: this.extractRequiredFields(validation)
      };
    }

    try {
      const validationResult = await this.performValidation(task, parameters, context);
      
      return {
        status: validationResult.valid ? 'success' : 'error',
        data: validationResult.valid ? {
          validated: true,
          details: validationResult.details
        } : undefined,
        error: validationResult.valid ? undefined : {
          code: validationResult.errorCode || 'VALIDATION_FAILED',
          message: validationResult.message || 'Validation failed',
          details: validationResult.details,
          retryable: false
        },
        metadata: {
          source: 'direct',
          confidence: validationResult.confidence || 1.0
        }
      };
    } catch (error: any) {
      return {
        status: 'error',
        error: {
          code: 'VALIDATION_ERROR',
          message: error.message || 'Error during validation',
          retryable: false
        }
      };
    }
  }

  /**
   * Perform validation - to be implemented by subclasses
   */
  protected async performValidation(
    task: string,
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<{
    valid: boolean;
    message?: string;
    errorCode?: string;
    details?: any;
    confidence?: number;
  }> {
    throw new Error('performValidation must be implemented by subclass');
  }

  /**
   * Extract required fields from validation result
   */
  protected extractRequiredFields(validation: any): Array<any> {
    if (validation.details?.violations) {
      return validation.details.violations.map((v: any) => ({
        field: v.field,
        type: 'string',
        description: v.message
      }));
    }
    return [];
  }

  /**
   * Validate against business rules
   */
  protected validateBusinessRules(
    task: string,
    parameters: Record<string, any>
  ): { valid: boolean; reason?: string } {
    const rules = this.validationRules[task];
    if (!rules) {
      return { valid: true };
    }

    // Apply validation rules
    // This is a simplified version - subclasses can override for specific logic
    return { valid: true };
  }
}


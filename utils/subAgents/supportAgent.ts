/**
 * Support Agent Module
 * 
 * Handles support-related tasks: creating tickets, getting help
 */

import { SubAgentModule, SubAgentConfig, TaskResult } from '../subAgentModule';
import { ConversationContext } from '../../types';
import { CentralLogger } from '../logger';

/**
 * Support Agent implementation
 */
export class SupportAgentModule extends SubAgentModule {
  constructor(config: SubAgentConfig, logger: CentralLogger) {
    super(config, logger);
  }

  protected setupSchemas(): void {
    this.taskSchemas.set('create_support_ticket', {
      type: 'object',
      required: ['task'],
      properties: {
        task: { type: 'string', enum: ['create_support_ticket'] },
        parameters: {
          type: 'object',
          required: ['issue_type', 'description'],
          properties: {
            issue_type: {
              type: 'string',
              enum: ['technical', 'billing', 'account', 'other']
            },
            description: {
              type: 'string',
              min: 10
            },
            severity: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'critical']
            }
          }
        }
      }
    });
  }

  protected async processTask(
    task: string,
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<TaskResult> {
    switch (task) {
      case 'create_support_ticket':
        return await this.createSupportTicket(parameters, context);
      default:
        return {
          status: 'error',
          error: {
            code: 'UNKNOWN_TASK',
            message: `Unknown task: ${task}`,
            retryable: false
          }
        };
    }
  }

  /**
   * Create a support ticket
   */
  private async createSupportTicket(
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<TaskResult> {
    // Check required fields
    const requiredFields = ['issue_type', 'description'];
    const missingFields = this.checkRequiredFields(parameters, requiredFields);

    if (missingFields.length > 0) {
      return {
        status: 'needs_info',
        required: missingFields.map(field => ({
          field,
          type: 'string',
          description: this.getFieldDescription(field),
          validation: field === 'description' ? { min: 10 } : undefined
        }))
      };
    }

    // Validate description length
    if (parameters.description && parameters.description.length < 10) {
      return {
        status: 'needs_info',
        required: [{
          field: 'description',
          type: 'string',
          description: 'Please provide a more detailed description (at least 10 characters)',
          validation: { min: 10 }
        }]
      };
    }

    // Create ticket
    const ticket = await this.createTicket({
      issue_type: parameters.issue_type,
      description: parameters.description,
      severity: parameters.severity || 'medium',
      caller_id: context.callerId,
      session_id: context.sessionId
    });

    if (!ticket) {
      return {
        status: 'error',
        error: {
          code: 'TICKET_CREATION_FAILED',
          message: 'Unable to create support ticket',
          retryable: true
        }
      };
    }

    return {
      status: 'success',
      data: {
        ticket: ticket
      },
      metadata: {
        source: 'direct',
        confidence: 1.0,
        suggestedActions: ['view_ticket', 'check_status']
      }
    };
  }

  /**
   * Get field description
   */
  private getFieldDescription(field: string): string {
    const descriptions: Record<string, string> = {
      issue_type: 'Type of issue (technical, billing, account, other)',
      description: 'Detailed description of the issue (at least 10 characters)',
      severity: 'Severity level (low, medium, high, critical)'
    };
    return descriptions[field] || field;
  }

  /**
   * Create a support ticket
   */
  private async createTicket(ticketData: {
    issue_type: string;
    description: string;
    severity: string;
    caller_id?: string;
    session_id?: string;
  }): Promise<any | null> {
    // In production, this would call external API/database
    const ticketId = `TKT-${Date.now()}-${Math.random().toString(36).substring(7).toUpperCase()}`;
    
    return {
      id: ticketId,
      issue_type: ticketData.issue_type,
      description: ticketData.description,
      severity: ticketData.severity,
      status: 'open',
      created_at: new Date().toISOString(),
      estimated_resolution: this.getEstimatedResolution(ticketData.severity)
    };
  }

  /**
   * Get estimated resolution time based on severity
   */
  private getEstimatedResolution(severity: string): string {
    const estimates: Record<string, string> = {
      low: '3-5 business days',
      medium: '1-2 business days',
      high: '4-8 hours',
      critical: '1-2 hours'
    };
    return estimates[severity] || estimates.medium;
  }
}


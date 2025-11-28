/**
 * Billing Agent Module
 * 
 * Handles billing-related tasks: getting billing information, processing payments
 */

import { SubAgentModule, SubAgentConfig, TaskResult } from '../subAgentModule';
import { ConversationContext } from '../../types';
import { CentralLogger } from '../logger';

/**
 * Billing Agent implementation
 */
export class BillingAgentModule extends SubAgentModule {
  constructor(config: SubAgentConfig, logger: CentralLogger) {
    super(config, logger);
  }

  protected setupSchemas(): void {
    this.taskSchemas.set('get_billing_info', {
      type: 'object',
      required: ['task'],
      properties: {
        task: { type: 'string', enum: ['get_billing_info'] },
        parameters: {
          type: 'object',
          properties: {
            account_id: { type: 'string' },
            month: { type: 'string', pattern: '^\\d{4}-\\d{2}$' }
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
      case 'get_billing_info':
        return await this.getBillingInfo(parameters, context);
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
   * Get billing information
   */
  private async getBillingInfo(
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<TaskResult> {
    // Check if account_id is provided
    if (!parameters.account_id) {
      // Check if user has multiple accounts (would come from context or data source)
      const multipleAccounts = await this.checkMultipleAccounts(context.callerId || '');

      if (multipleAccounts && multipleAccounts.length > 1) {
        return {
          status: 'needs_info',
          clarification: {
            question: 'Which account would you like to see the bill for?',
            options: multipleAccounts.map(acc => ({
              value: acc.id,
              label: `${acc.type} Account (ending in ${acc.lastFour})`
            })),
            type: 'single_choice'
          }
        };
      }
    }

    // Resolve month if needed
    let month = parameters.month;
    if (!month || month === 'current') {
      const now = new Date();
      month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    // Get billing data
    const billingData = await this.getBillingData(
      parameters.account_id || context.metadata?.defaultAccountId,
      month
    );

    if (!billingData) {
      return {
        status: 'error',
        error: {
          code: 'BILLING_INFO_NOT_FOUND',
          message: 'No billing information found for the specified period',
          retryable: false
        }
      };
    }

    return {
      status: 'success',
      data: {
        billing: billingData
      },
      metadata: {
        source: 'direct',
        confidence: 1.0
      }
    };
  }

  /**
   * Check if user has multiple accounts
   */
  private async checkMultipleAccounts(callerId: string): Promise<Array<{ id: string; type: string; lastFour: string }> | null> {
    // In production, this would query the database
    if (callerId === 'user_789') {
      return [
        { id: 'acc_456', type: 'Personal', lastFour: '4567' },
        { id: 'acc_789', type: 'Business', lastFour: '7890' }
      ];
    }
    return null;
  }

  /**
   * Get billing data
   */
  private async getBillingData(accountId: string, month: string): Promise<any | null> {
    // In production, this would call external API/database
    if (accountId === 'acc_456' && month === '2025-01') {
      return {
        account_id: 'acc_456',
        month: '2025-01',
        total_amount: 125.50,
        currency: 'USD',
        items: [
          { description: 'Monthly service fee', amount: 99.99 },
          { description: 'Additional features', amount: 25.51 }
        ],
        due_date: '2025-02-01',
        status: 'pending'
      };
    }
    return null;
  }
}


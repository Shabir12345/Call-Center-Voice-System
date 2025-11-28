/**
 * Data Retrieval Agent Pattern
 * 
 * Base pattern for agents that primarily retrieve data from external sources.
 */

import { SubAgentModule, SubAgentConfig, TaskResult } from '../subAgentModule';
import { ConversationContext } from '../../types';
import { CentralLogger } from '../logger';

/**
 * Data Retrieval Agent - Pattern implementation
 */
export class DataRetrievalAgent extends SubAgentModule {
  protected dataSource: any; // External data source interface

  constructor(config: SubAgentConfig, logger: CentralLogger, dataSource?: any) {
    super(config, logger);
    this.dataSource = dataSource || config.dataSource;
  }

  protected async processTask(
    task: string,
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<TaskResult> {
    // Pattern: Validate parameters, retrieve data, format response
    const validation = this.validateRetrievalParameters(parameters, task);
    if (!validation.valid) {
      return {
        status: 'needs_info',
        required: validation.required || []
      };
    }

    try {
      const data = await this.retrieveData(task, parameters, context);
      
      if (!data) {
        return {
          status: 'error',
          error: {
            code: 'DATA_NOT_FOUND',
            message: 'No data found matching the criteria',
            retryable: false
          }
        };
      }

      return {
        status: 'success',
        data: {
          result: data
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
          code: 'RETRIEVAL_ERROR',
          message: error.message || 'Error retrieving data',
          retryable: this.isRetryableError(error)
        }
      };
    }
  }

  /**
   * Validate retrieval parameters - to be implemented by subclasses
   */
  protected validateRetrievalParameters(
    parameters: Record<string, any>,
    task: string
  ): { valid: boolean; required?: Array<any> } {
    return { valid: true };
  }

  /**
   * Retrieve data - to be implemented by subclasses
   */
  protected async retrieveData(
    task: string,
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<any> {
    throw new Error('retrieveData must be implemented by subclass');
  }

  /**
   * Check if error is retryable
   */
  protected isRetryableError(error: any): boolean {
    const retryablePatterns = [
      'timeout',
      'network',
      'ECONNREFUSED',
      'ETIMEDOUT',
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


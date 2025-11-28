/**
 * Calculation Agent Pattern
 * 
 * Base pattern for agents that perform calculations, computations, and generate reports.
 */

import { SubAgentModule, SubAgentConfig, TaskResult } from '../subAgentModule';
import { ConversationContext } from '../../types';
import { CentralLogger } from '../logger';

/**
 * Calculation Agent - Pattern implementation
 */
export class CalculationAgent extends SubAgentModule {
  protected calculationEngine: any; // Calculation engine interface

  constructor(config: SubAgentConfig, logger: CentralLogger, calculationEngine?: any) {
    super(config, logger);
    this.calculationEngine = calculationEngine || config.dataSource;
  }

  protected async processTask(
    task: string,
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<TaskResult> {
    // Pattern: Validate input, perform calculation, format result
    const validation = this.validateCalculationParameters(parameters, task);
    if (!validation.valid) {
      return {
        status: 'needs_info',
        required: validation.required || []
      };
    }

    try {
      const result = await this.performCalculation(task, parameters, context);
      
      return {
        status: 'success',
        data: {
          calculation: task,
          result: result.value,
          details: result.details,
          formula: result.formula,
          units: result.units
        },
        metadata: {
          source: 'direct',
          confidence: result.confidence || 1.0,
          processingTime: result.processingTime
        }
      };
    } catch (error: any) {
      return {
        status: 'error',
        error: {
          code: 'CALCULATION_ERROR',
          message: error.message || 'Error performing calculation',
          details: {
            task,
            parameters
          },
          retryable: false
        }
      };
    }
  }

  /**
   * Validate calculation parameters - to be implemented by subclasses
   */
  protected validateCalculationParameters(
    parameters: Record<string, any>,
    task: string
  ): { valid: boolean; required?: Array<any> } {
    return { valid: true };
  }

  /**
   * Perform calculation - to be implemented by subclasses
   */
  protected async performCalculation(
    task: string,
    parameters: Record<string, any>,
    context: ConversationContext
  ): Promise<{
    value: number | any;
    details?: any;
    formula?: string;
    units?: string;
    confidence?: number;
    processingTime?: number;
  }> {
    throw new Error('performCalculation must be implemented by subclass');
  }

  /**
   * Validate numeric input
   */
  protected validateNumericInput(value: any, fieldName: string): {
    valid: boolean;
    error?: string;
    numericValue?: number;
  } {
    if (value === undefined || value === null) {
      return { valid: false, error: `Field '${fieldName}' is required` };
    }

    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(numValue)) {
      return { valid: false, error: `Field '${fieldName}' must be a number` };
    }

    return { valid: true, numericValue: numValue };
  }

  /**
   * Round result to specified decimal places
   */
  protected roundResult(value: number, decimalPlaces: number = 2): number {
    const factor = Math.pow(10, decimalPlaces);
    return Math.round(value * factor) / factor;
  }
}


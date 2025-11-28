/**
 * Tool Agent Executor
 * 
 * Executes tool functions and connects to integration nodes.
 * Handles parameter validation, output schema validation, and success criteria checking.
 */

import { SubAgentNodeData, IntegrationNodeData } from '../types';
import { EnhancedValidator, SchemaDefinition } from './enhancedValidator';
import { RestApiIntegration } from './integrations/restIntegration';
import { GraphQLIntegration } from './integrations/graphqlIntegration';
import { DatabaseIntegration } from './integrations/databaseIntegration';
import { CentralLogger } from './logger';
import { ErrorCode, createErrorResponse } from './errorHandling';

/**
 * Tool execution result
 */
export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  metadata?: {
    executionTime: number;
    source: 'rest' | 'graphql' | 'database' | 'mock';
  };
}

/**
 * Tool Agent Executor
 */
export class ToolAgentExecutor {
  private validator: EnhancedValidator;
  private logger: CentralLogger;

  constructor(logger: CentralLogger) {
    this.validator = new EnhancedValidator();
    this.logger = logger;
  }

  /**
   * Execute tool function
   */
  async executeTool(
    toolConfig: SubAgentNodeData,
    integrationConfig: IntegrationNodeData,
    parameters: Record<string, any>
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      // 1. Validate input parameters
      const inputValidation = this.validateInputParameters(
        parameters,
        toolConfig.parameters || []
      );

      if (!inputValidation.valid) {
        return {
          success: false,
          error: {
            code: ErrorCode.INVALID_INPUT,
            message: inputValidation.error || 'Invalid input parameters',
            details: inputValidation.details
          }
        };
      }

      // 2. Execute based on integration type
      let result: any;
      let source: 'rest' | 'graphql' | 'database' | 'mock';

      switch (integrationConfig.integrationType) {
        case 'rest':
          source = 'rest';
          result = await this.executeRestApi(integrationConfig, parameters);
          break;

        case 'graphql':
          source = 'graphql';
          result = await this.executeGraphQL(integrationConfig, parameters);
          break;

        case 'mock':
          source = 'mock';
          result = await this.executeMock(integrationConfig, parameters);
          break;

        default:
          throw new Error(`Unsupported integration type: ${integrationConfig.integrationType}`);
      }

      // 3. Transform response if needed
      const transformedResult = this.transformResponse(
        result,
        integrationConfig.dataStructure,
        integrationConfig.aiInstructions
      );

      // 4. Validate output schema
      if (toolConfig.outputSchema) {
        const outputValidation = this.validateOutputSchema(
          transformedResult,
          toolConfig.outputSchema
        );

        if (!outputValidation.valid) {
          return {
            success: false,
            error: {
              code: ErrorCode.INVALID_OUTPUT,
              message: 'Tool output does not match expected schema',
              details: outputValidation.details
            }
          };
        }
      }

      // 5. Check success criteria
      const successCriteriaMet = this.checkSuccessCriteria(
        transformedResult,
        toolConfig.successCriteria
      );

      if (!successCriteriaMet) {
        return {
          success: false,
          error: {
            code: ErrorCode.BUSINESS_RULE_VIOLATION,
            message: 'Tool execution did not meet success criteria',
            details: {
              successCriteria: toolConfig.successCriteria
            }
          }
        };
      }

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        data: transformedResult,
        metadata: {
          executionTime,
          source
        }
      };

    } catch (error: any) {
      this.logger.error('Tool execution failed', error, {
        toolName: toolConfig.functionName,
        integrationType: integrationConfig.integrationType
      });

      return {
        success: false,
        error: {
          code: ErrorCode.EXTERNAL_API_FAILURE,
          message: error.message || 'Tool execution failed',
          details: {
            toolName: toolConfig.functionName,
            error: error.toString()
          }
        }
      };
    }
  }

  /**
   * Validate input parameters
   */
  private validateInputParameters(
    parameters: Record<string, any>,
    parameterSchema: Array<{ name: string; type: string; required: boolean; description?: string }>
  ): { valid: boolean; error?: string; details?: any } {
    if (!parameterSchema || parameterSchema.length === 0) {
      return { valid: true };
    }

    const missing: string[] = [];
    const invalid: Array<{ field: string; reason: string }> = [];

    for (const param of parameterSchema) {
      if (param.required && (parameters[param.name] === undefined || parameters[param.name] === null)) {
        missing.push(param.name);
      } else if (parameters[param.name] !== undefined) {
        // Type validation
        const value = parameters[param.name];
        const typeValid = this.validateType(value, param.type);
        if (!typeValid) {
          invalid.push({
            field: param.name,
            reason: `Expected type ${param.type}, got ${typeof value}`
          });
        }
      }
    }

    if (missing.length > 0 || invalid.length > 0) {
      return {
        valid: false,
        error: `Validation failed: ${missing.length > 0 ? `Missing: ${missing.join(', ')}` : ''} ${invalid.length > 0 ? `Invalid: ${invalid.map(i => i.field).join(', ')}` : ''}`,
        details: { missing, invalid }
      };
    }

    return { valid: true };
  }

  /**
   * Validate type
   */
  private validateType(value: any, expectedType: string): boolean {
    switch (expectedType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number' && !isNaN(value);
      case 'boolean':
        return typeof value === 'boolean';
      case 'json':
        return typeof value === 'object';
      default:
        return true;
    }
  }

  /**
   * Execute REST API
   */
  private async executeRestApi(
    config: IntegrationNodeData,
    parameters: Record<string, any>
  ): Promise<any> {
    const integration = new RestApiIntegration();
    const response = await integration.execute(config, parameters);

    if (!response.success) {
      throw new Error(response.error || 'REST API call failed');
    }

    return response.data;
  }

  /**
   * Execute GraphQL
   */
  private async executeGraphQL(
    config: IntegrationNodeData,
    parameters: Record<string, any>
  ): Promise<any> {
    const integration = new GraphQLIntegration();
    const response = await integration.execute(config, parameters);

    if (!response.success) {
      throw new Error(response.errors?.[0]?.message || 'GraphQL query failed');
    }

    return response.data;
  }

  /**
   * Execute mock
   */
  private async executeMock(
    config: IntegrationNodeData,
    parameters: Record<string, any>
  ): Promise<any> {
    if (!config.mockOutput) {
      return { message: 'Mock execution completed', parameters };
    }

    try {
      const mockData = typeof config.mockOutput === 'string'
        ? JSON.parse(config.mockOutput)
        : config.mockOutput;

      // Replace placeholders with actual parameters
      return this.replacePlaceholders(mockData, parameters);
    } catch (e) {
      return config.mockOutput;
    }
  }

  /**
   * Replace placeholders in mock data
   */
  private replacePlaceholders(data: any, parameters: Record<string, any>): any {
    if (typeof data === 'string') {
      // Replace ${paramName} with actual values
      return data.replace(/\$\{(\w+)\}/g, (match, key) => {
        return parameters[key] !== undefined ? String(parameters[key]) : match;
      });
    }

    if (Array.isArray(data)) {
      return data.map(item => this.replacePlaceholders(item, parameters));
    }

    if (typeof data === 'object' && data !== null) {
      const result: any = {};
      for (const [key, value] of Object.entries(data)) {
        result[key] = this.replacePlaceholders(value, parameters);
      }
      return result;
    }

    return data;
  }

  /**
   * Transform response based on data structure and AI instructions
   */
  private transformResponse(
    response: any,
    dataStructure?: string,
    aiInstructions?: string
  ): any {
    let transformed = response;

    // Apply data structure transformation if specified
    if (dataStructure) {
      try {
        const structure = typeof dataStructure === 'string'
          ? JSON.parse(dataStructure)
          : dataStructure;

        transformed = this.applyDataStructure(response, structure);
      } catch (e) {
        this.logger.warn('Failed to parse data structure', { error: e });
      }
    }

    // AI instructions would be used by AI to transform response
    // For now, return as-is
    if (aiInstructions) {
      // In production, this could use AI to transform based on instructions
      // For now, just log the instructions
      this.logger.debug('AI transformation instructions', { instructions: aiInstructions });
    }

    return transformed;
  }

  /**
   * Apply data structure transformation
   */
  private applyDataStructure(data: any, structure: any): any {
    // Simple structure mapping
    // In production, this would be more sophisticated
    if (structure.mapping) {
      const result: any = {};
      for (const [targetKey, sourcePath] of Object.entries(structure.mapping)) {
        result[targetKey] = this.getNestedValue(data, sourcePath as string);
      }
      return result;
    }

    return data;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Validate output schema
   */
  private validateOutputSchema(
    output: any,
    schemaString: string
  ): { valid: boolean; details?: any } {
    try {
      const schema: SchemaDefinition = typeof schemaString === 'string'
        ? JSON.parse(schemaString)
        : schemaString;

      const validation = this.validator.validateOutput(output, schema);
      return {
        valid: validation.isValid,
        details: validation.details
      };
    } catch (e) {
      this.logger.warn('Failed to validate output schema', { error: e });
      return { valid: true }; // Don't fail if schema parsing fails
    }
  }

  /**
   * Check success criteria
   */
  private checkSuccessCriteria(
    result: any,
    successCriteria?: string
  ): boolean {
    if (!successCriteria) {
      return true; // No criteria means always successful
    }

    try {
      // Parse success criteria (could be JSON or expression)
      // For now, simple checks
      if (successCriteria.includes('status') && result.status) {
        return result.status === 'success' || result.status === 'ok';
      }

      if (successCriteria.includes('error') && result.error) {
        return false;
      }

      // Default: if result exists, consider it successful
      return result !== null && result !== undefined;
    } catch (e) {
      this.logger.warn('Failed to check success criteria', { error: e });
      return true; // Default to success if criteria check fails
    }
  }
}


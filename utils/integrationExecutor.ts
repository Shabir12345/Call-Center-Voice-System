/**
 * Shared Integration Executor
 * 
 * Executes Integration Nodes (Mock, REST, GraphQL) in a unified way.
 * Can be used by both TestPanel and SystemOrchestrator.
 */

import { IntegrationNodeData } from '../types';
import { RestApiIntegration } from './integrations/restIntegration';
import { GraphQLIntegration } from './integrations/graphqlIntegration';
import { withTimeout, withRetry, isRetryableError } from './responseValidator';
import { normalizeSubAgentResponse } from './responseValidator';
import { CentralLogger } from './logger';
import { Tracer } from './tracing';

export interface IntegrationExecutorOptions {
  timeout?: number;
  retry?: {
    enabled: boolean;
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
  };
  logger?: CentralLogger;
  tracer?: Tracer;
}

export interface IntegrationExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  errorCode?: string;
  duration: number;
  source: 'mock' | 'rest' | 'graphql';
}

/**
 * Shared Integration Executor
 * Executes Integration Nodes in a unified way
 */
export class IntegrationExecutor {
  private restIntegration: RestApiIntegration;
  private graphQLIntegration: GraphQLIntegration;
  private logger?: CentralLogger;
  private tracer?: Tracer;
  private defaultTimeout: number;
  private retryConfig: {
    enabled: boolean;
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
  };

  constructor(options: IntegrationExecutorOptions = {}) {
    this.restIntegration = new RestApiIntegration();
    this.graphQLIntegration = new GraphQLIntegration();
    this.logger = options.logger;
    this.tracer = options.tracer;
    this.defaultTimeout = options.timeout || 30000;
    this.retryConfig = options.retry || {
      enabled: true,
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000
    };
  }

  /**
   * Execute an integration node
   */
  async execute(
    integrationConfig: IntegrationNodeData,
    parameters: Record<string, any> = {},
    options: {
      timeout?: number;
      enableRetry?: boolean;
      traceContext?: { spanId: string; tracer: Tracer };
    } = {}
  ): Promise<IntegrationExecutionResult> {
    const startTime = Date.now();
    const timeout = options.timeout || this.defaultTimeout;
    const enableRetry = options.enableRetry !== false && this.retryConfig.enabled;

    // Create trace span
    const traceSpan = options.traceContext?.tracer?.startSpan(
      `integration:${integrationConfig.integrationType}`,
      options.traceContext?.spanId ? { spanId: options.traceContext.spanId } : undefined,
      {
        integrationType: integrationConfig.integrationType,
        url: integrationConfig.url || 'N/A',
        label: integrationConfig.label
      }
    );

    try {
      // Simulate latency if configured
      if (integrationConfig.latency && integrationConfig.latency > 0) {
        await new Promise(r => setTimeout(r, integrationConfig.latency));
      }

      // Execute integration based on type
      const executeIntegration = async () => {
        switch (integrationConfig.integrationType) {
          case 'mock':
            return await this.executeMock(integrationConfig, parameters);
          
          case 'rest':
            if (!integrationConfig.url) {
              throw new Error('REST integration URL is not configured');
            }
            const restResult = await this.restIntegration.execute(integrationConfig, parameters);
            return {
              status: restResult.success ? 'success' : 'error',
              source: 'rest_api',
              data: restResult.data,
              error: restResult.error,
              errorCode: restResult.statusCode ? `REST_${restResult.statusCode}` : undefined
            };
          
          case 'graphql':
            if (!integrationConfig.url || !integrationConfig.graphQLQuery) {
              throw new Error('GraphQL integration URL or query is not configured');
            }
            const graphqlResult = await this.graphQLIntegration.execute(integrationConfig, parameters);
            return {
              status: graphqlResult.success ? 'success' : 'error',
              source: 'graphql_api',
              data: graphqlResult.data,
              error: graphqlResult.errors ? JSON.stringify(graphqlResult.errors) : graphqlResult.error,
              errorCode: graphqlResult.errors ? 'GRAPHQL_QUERY_ERROR' : undefined
            };
          
          default:
            throw new Error(`Unsupported integration type: ${integrationConfig.integrationType}`);
        }
      };

      // Execute with timeout and optional retry
      let result: any;
      if (enableRetry) {
        result = await withRetry(
          () => withTimeout(
            executeIntegration(),
            timeout,
            `Integration execution timeout after ${timeout}ms`
          ),
          {
            maxRetries: this.retryConfig.maxRetries,
            initialDelay: this.retryConfig.initialDelay,
            maxDelay: this.retryConfig.maxDelay,
            shouldRetry: isRetryableError
          }
        );
      } else {
        result = await withTimeout(
          executeIntegration(),
          timeout,
          `Integration execution timeout after ${timeout}ms`
        );
      }

      const duration = Date.now() - startTime;

      // Normalize response
      const normalized = normalizeSubAgentResponse(result, 'direct', { duration });

      // End trace span
      if (traceSpan) {
        options.traceContext?.tracer?.endSpan(traceSpan.spanId, {
          success: normalized.success,
          duration,
          error: normalized.error,
          errorCode: normalized.errorCode
        });
      }

      // Log result
      if (this.logger) {
        if (normalized.success) {
          this.logger.debug('Integration execution succeeded', {
            type: integrationConfig.integrationType,
            label: integrationConfig.label,
            duration
          });
        } else {
          this.logger.error('Integration execution failed', {
            type: integrationConfig.integrationType,
            label: integrationConfig.label,
            error: normalized.error,
            errorCode: normalized.errorCode,
            duration
          });
        }
      }

      return {
        success: normalized.success,
        data: normalized.data,
        error: normalized.error,
        errorCode: normalized.errorCode,
        duration,
        source: this.getSourceType(integrationConfig.integrationType)
      };

    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errorMsg = error.message || 'Unknown error occurred during integration execution';
      const errorCode = error.message?.includes('timeout') ? 'INTEGRATION_TIMEOUT' : 'INTEGRATION_EXECUTION_ERROR';

      // End trace span with error
      if (traceSpan) {
        options.traceContext?.tracer?.endSpan(traceSpan.spanId, {
          success: false,
          duration,
          error: errorMsg,
          errorCode
        });
      }

      // Log error
      if (this.logger) {
        this.logger.error('Integration execution error', {
          type: integrationConfig.integrationType,
          label: integrationConfig.label,
          error: errorMsg,
          errorCode,
          stack: error.stack,
          duration
        });
      }

      return {
        success: false,
        error: errorMsg,
        errorCode,
        duration,
        source: this.getSourceType(integrationConfig.integrationType)
      };
    }
  }

  /**
   * Execute mock integration
   */
  private async executeMock(
    intData: IntegrationNodeData,
    args: Record<string, any>
  ): Promise<any> {
    if (!intData.mockOutput) {
      return {
        error: 'Mock integration has no output data configured',
        errorCode: 'MOCK_NO_OUTPUT'
      };
    }

    try {
      const mockData = JSON.parse(intData.mockOutput);
      
      if (typeof mockData !== 'object') {
        return {
          error: 'Mock output must be a JSON object',
          errorCode: 'MOCK_INVALID_FORMAT'
        };
      }

      return {
        status: 'success',
        source: 'mock_db',
        data: mockData,
        args_received: args
      };
    } catch (e: any) {
      return {
        error: `Integration Node has invalid JSON mock output: ${e.message}`,
        errorCode: 'MOCK_JSON_PARSE_ERROR'
      };
    }
  }

  /**
   * Get source type from integration type
   */
  private getSourceType(integrationType: string): 'mock' | 'rest' | 'graphql' {
    switch (integrationType) {
      case 'rest':
        return 'rest';
      case 'graphql':
        return 'graphql';
      default:
        return 'mock';
    }
  }

  /**
   * Validate integration configuration
   */
  validateIntegration(config: IntegrationNodeData): { valid: boolean; error?: string } {
    if (!config.integrationType) {
      return { valid: false, error: 'Integration type is required' };
    }

    switch (config.integrationType) {
      case 'mock':
        if (!config.mockOutput) {
          return { valid: false, error: 'Mock integration requires mockOutput' };
        }
        try {
          JSON.parse(config.mockOutput);
        } catch (e) {
          return { valid: false, error: 'Mock output must be valid JSON' };
        }
        break;

      case 'rest':
        if (!config.url) {
          return { valid: false, error: 'REST integration requires URL' };
        }
        break;

      case 'graphql':
        if (!config.url) {
          return { valid: false, error: 'GraphQL integration requires URL' };
        }
        if (!config.graphQLQuery) {
          return { valid: false, error: 'GraphQL integration requires query' };
        }
        break;

      default:
        return { valid: false, error: `Unknown integration type: ${config.integrationType}` };
    }

    return { valid: true };
  }
}


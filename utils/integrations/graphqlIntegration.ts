/**
 * GraphQL Integration
 * 
 * Handles GraphQL API calls for sub-agents and tool agents.
 */

import { IntegrationNodeData } from '../../types';
import { withRetry } from '../responseValidator';

/**
 * GraphQL response
 */
export interface GraphQLResponse {
  success: boolean;
  data?: any;
  errors?: Array<{ message: string; path?: string[] }>;
  statusCode?: number;
}

/**
 * GraphQL Integration handler
 */
export class GraphQLIntegration {
  /**
   * Execute GraphQL query
   */
  async execute(
    config: IntegrationNodeData,
    variables: Record<string, any> = {}
  ): Promise<GraphQLResponse> {
    const {
      url,
      graphQLQuery,
      graphQLVariables,
      headers: configHeaders,
      authType,
      authToken,
      apiHeaderName,
      latency
    } = config;

    if (!url) {
      throw new Error('URL is required for GraphQL integration');
    }

    if (!graphQLQuery) {
      throw new Error('GraphQL query is required');
    }

    // Build headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    // Parse custom headers
    if (configHeaders) {
      try {
        const parsed = typeof configHeaders === 'string' 
          ? JSON.parse(configHeaders) 
          : configHeaders;
        Object.assign(headers, parsed);
      } catch (e) {
        console.warn('Failed to parse headers:', e);
      }
    }

    // Add authentication
    if (authType && authToken) {
      switch (authType) {
        case 'bearer':
          headers['Authorization'] = `Bearer ${authToken}`;
          break;
        case 'apiKey':
          const headerName = apiHeaderName || 'X-API-Key';
          headers[headerName] = authToken;
          break;
      }
    }

    // Merge variables
    let finalVariables = variables;
    if (graphQLVariables) {
      try {
        const parsed = typeof graphQLVariables === 'string'
          ? JSON.parse(graphQLVariables)
          : graphQLVariables;
        finalVariables = { ...parsed, ...variables };
      } catch (e) {
        console.warn('Failed to parse GraphQL variables:', e);
      }
    }

    // Build request body
    const requestBody = JSON.stringify({
      query: graphQLQuery,
      variables: finalVariables
    });

    try {
      // Simulate latency if configured
      if (latency && latency > 0) {
        await this.delay(latency);
      }

      // Execute request with retry
      const response = await withRetry(
        async () => {
          const fetchResponse = await fetch(url, {
            method: 'POST',
            headers,
            body: requestBody
          });

          const responseData = await fetchResponse.json();

          if (!fetchResponse.ok) {
            throw new Error(`HTTP ${fetchResponse.status}: GraphQL request failed`);
          }

          // Check for GraphQL errors
          if (responseData.errors && responseData.errors.length > 0) {
            return {
              success: false,
              errors: responseData.errors,
              statusCode: fetchResponse.status
            };
          }

          return {
            success: true,
            data: responseData.data,
            statusCode: fetchResponse.status
          };
        },
        {
          maxRetries: 2,
          initialDelay: 1000,
          maxDelay: 5000,
          shouldRetry: (error) => {
            const errorMessage = error.message || '';
            return errorMessage.includes('timeout') || 
                   errorMessage.includes('network') ||
                   errorMessage.includes('503');
          }
        }
      );

      return response;

    } catch (error: any) {
      return {
        success: false,
        errors: [{ message: error.message || 'GraphQL request failed' }],
        statusCode: error.statusCode || 500
      };
    }
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}


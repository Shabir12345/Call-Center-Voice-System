/**
 * REST API Integration
 * 
 * Handles REST API calls for sub-agents and tool agents.
 */

import { IntegrationNodeData } from '../../types';
import { withRetry, RetryConfig } from '../responseValidator';
import { ErrorCode, createErrorResponse } from '../errorHandling';

/**
 * REST API response
 */
export interface RestApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  statusCode?: number;
  headers?: Record<string, string>;
}

/**
 * REST API Integration handler
 */
export class RestApiIntegration {
  /**
   * Execute REST API call
   */
  async execute(
    config: IntegrationNodeData,
    parameters: Record<string, any> = {}
  ): Promise<RestApiResponse> {
    const {
      url,
      method = 'GET',
      headers: configHeaders,
      authType,
      authToken,
      apiHeaderName,
      body,
      latency
    } = config;

    if (!url) {
      throw new Error('URL is required for REST API integration');
    }

    // Build headers
    const headers = this.buildHeaders(configHeaders, authType, authToken, apiHeaderName);

    // Build request body
    const requestBody = this.buildRequestBody(body, parameters);

    // Build full URL with parameters for GET requests
    const fullUrl = method === 'GET' && Object.keys(parameters).length > 0
      ? this.buildUrlWithParams(url, parameters)
      : url;

    try {
      // Simulate latency if configured
      if (latency && latency > 0) {
        await this.delay(latency);
      }

      // Execute request with retry
      const response = await withRetry(
        async () => {
          const fetchResponse = await fetch(fullUrl, {
            method,
            headers,
            body: method !== 'GET' ? requestBody : undefined
          });

          const responseData = await this.parseResponse(fetchResponse);

          if (!fetchResponse.ok) {
            throw new Error(`HTTP ${fetchResponse.status}: ${responseData.error || 'Request failed'}`);
          }

          return {
            success: true,
            data: responseData,
            statusCode: fetchResponse.status,
            headers: this.extractHeaders(fetchResponse)
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
                   errorMessage.includes('503') ||
                   errorMessage.includes('502');
          }
        }
      );

      return response;

    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'REST API call failed',
        statusCode: error.statusCode || 500
      };
    }
  }

  /**
   * Build headers
   */
  private buildHeaders(
    configHeaders?: string,
    authType?: string,
    authToken?: string,
    apiHeaderName?: string
  ): Record<string, string> {
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
        // If not JSON, treat as single header string
        console.warn('Failed to parse headers as JSON:', e);
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
        case 'custom':
          // Custom auth handled in headers string
          break;
      }
    }

    return headers;
  }

  /**
   * Build request body
   */
  private buildRequestBody(body?: string, parameters?: Record<string, any>): string | undefined {
    if (!body) {
      return undefined;
    }

    try {
      // Try to parse as JSON and merge with parameters
      const parsed = JSON.parse(body);
      const merged = { ...parsed, ...parameters };
      return JSON.stringify(merged);
    } catch (e) {
      // If not JSON, return as-is or merge parameters
      if (parameters && Object.keys(parameters).length > 0) {
        return JSON.stringify(parameters);
      }
      return body;
    }
  }

  /**
   * Build URL with query parameters
   */
  private buildUrlWithParams(url: string, parameters: Record<string, any>): string {
    const urlObj = new URL(url);
    for (const [key, value] of Object.entries(parameters)) {
      if (value !== undefined && value !== null) {
        urlObj.searchParams.append(key, String(value));
      }
    }
    return urlObj.toString();
  }

  /**
   * Parse response
   */
  private async parseResponse(response: Response): Promise<any> {
    const contentType = response.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      return await response.json();
    } else if (contentType.includes('text/')) {
      return { text: await response.text() };
    } else {
      return { data: await response.arrayBuffer() };
    }
  }

  /**
   * Extract headers from response
   */
  private extractHeaders(response: Response): Record<string, string> {
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });
    return headers;
  }

  /**
   * Delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}


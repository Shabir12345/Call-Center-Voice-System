/**
 * Unit tests for Integration utilities
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RestApiIntegration } from '../../utils/integrations/restIntegration';
import { GraphQLIntegration } from '../../utils/integrations/graphqlIntegration';
import { DatabaseIntegration } from '../../utils/integrations/databaseIntegration';
import { IntegrationNodeData, DatabaseConfig } from '../../types';

// Mock fetch globally
global.fetch = vi.fn();

describe('RestApiIntegration', () => {
  let integration: RestApiIntegration;

  beforeEach(() => {
    integration = new RestApiIntegration();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('execute', () => {
    it('should execute GET request successfully', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ data: 'success' }),
        headers: new Headers()
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const config: IntegrationNodeData = {
        id: 'rest_1',
        label: 'Test REST',
        integrationType: 'rest',
        url: 'https://api.example.com/data',
        method: 'GET'
      };

      const result = await integration.execute(config);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ data: 'success' });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          method: 'GET'
        })
      );
    });

    it('should execute POST request with body', async () => {
      const mockResponse = {
        ok: true,
        status: 201,
        json: async () => ({ id: 123 }),
        headers: new Headers()
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const config: IntegrationNodeData = {
        id: 'rest_2',
        label: 'Test POST',
        integrationType: 'rest',
        url: 'https://api.example.com/create',
        method: 'POST',
        body: JSON.stringify({ name: 'Test' })
      };

      const result = await integration.execute(config, { name: 'Test' });

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: expect.any(String)
        })
      );
    });

    it('should handle authentication headers', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({}),
        headers: new Headers()
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const config: IntegrationNodeData = {
        id: 'rest_auth',
        label: 'Auth REST',
        integrationType: 'rest',
        url: 'https://api.example.com/protected',
        method: 'GET',
        authType: 'bearer',
        authToken: 'token123'
      };

      await integration.execute(config);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer token123'
          })
        })
      );
    });

    it('should handle API key authentication', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({}),
        headers: new Headers()
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const config: IntegrationNodeData = {
        id: 'rest_api_key',
        label: 'API Key REST',
        integrationType: 'rest',
        url: 'https://api.example.com/data',
        method: 'GET',
        authType: 'apiKey',
        authToken: 'key123',
        apiHeaderName: 'X-API-Key'
      };

      await integration.execute(config);

      const callArgs = (global.fetch as any).mock.calls[0];
      const headers = callArgs[1].headers;

      expect(headers['X-API-Key']).toBe('key123');
    });

    it('should throw error if URL is missing', async () => {
      const config: IntegrationNodeData = {
        id: 'rest_no_url',
        label: 'No URL',
        integrationType: 'rest',
        method: 'GET'
      };

      await expect(integration.execute(config)).rejects.toThrow('URL is required');
    });

    it('should handle HTTP error responses', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Not found' }),
        headers: new Headers()
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const config: IntegrationNodeData = {
        id: 'rest_error',
        label: 'Error REST',
        integrationType: 'rest',
        url: 'https://api.example.com/notfound',
        method: 'GET'
      };

      const result = await integration.execute(config);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle network errors with retry', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const config: IntegrationNodeData = {
        id: 'rest_network',
        label: 'Network Error',
        integrationType: 'rest',
        url: 'https://api.example.com/data',
        method: 'GET'
      };

      // Should handle error gracefully (withRetry will attempt)
      await expect(integration.execute(config)).rejects.toThrow();
    });
  });

  describe('buildUrlWithParams', () => {
    it('should append query parameters to URL', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({}),
        headers: new Headers()
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const config: IntegrationNodeData = {
        id: 'rest_params',
        label: 'Params REST',
        integrationType: 'rest',
        url: 'https://api.example.com/search',
        method: 'GET'
      };

      await integration.execute(config, { q: 'test', limit: 10 });

      const callArgs = (global.fetch as any).mock.calls[0];
      expect(callArgs[0]).toContain('q=test');
      expect(callArgs[0]).toContain('limit=10');
    });
  });
});

describe('GraphQLIntegration', () => {
  let integration: GraphQLIntegration;

  beforeEach(() => {
    integration = new GraphQLIntegration();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('execute', () => {
    it('should execute GraphQL query successfully', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          data: { users: [{ id: 1, name: 'John' }] }
        }),
        headers: new Headers()
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const config: IntegrationNodeData = {
        id: 'graphql_1',
        label: 'Test GraphQL',
        integrationType: 'graphql',
        url: 'https://api.example.com/graphql',
        graphQLQuery: 'query { users { id name } }'
      };

      const result = await integration.execute(config);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/graphql',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: expect.stringContaining('query')
        })
      );
    });

    it('should handle GraphQL variables', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ data: {} }),
        headers: new Headers()
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const config: IntegrationNodeData = {
        id: 'graphql_vars',
        label: 'GraphQL Vars',
        integrationType: 'graphql',
        url: 'https://api.example.com/graphql',
        graphQLQuery: 'query($id: ID!) { user(id: $id) { name } }',
        graphQLVariables: '{"id": "123"}'
      };

      await integration.execute(config, { id: '123' });

      const callArgs = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(callArgs[1].body);
      
      expect(body.variables).toBeDefined();
      expect(body.variables.id).toBe('123');
    });

    it('should handle GraphQL errors', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          errors: [{ message: 'User not found', path: ['user'] }]
        }),
        headers: new Headers()
      };

      (global.fetch as any).mockResolvedValue(mockResponse);

      const config: IntegrationNodeData = {
        id: 'graphql_error',
        label: 'GraphQL Error',
        integrationType: 'graphql',
        url: 'https://api.example.com/graphql',
        graphQLQuery: 'query { user { name } }'
      };

      const result = await integration.execute(config);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0].message).toBe('User not found');
    });

    it('should throw error if URL is missing', async () => {
      const config: IntegrationNodeData = {
        id: 'graphql_no_url',
        label: 'No URL',
        integrationType: 'graphql',
        graphQLQuery: 'query { test }'
      };

      await expect(integration.execute(config)).rejects.toThrow('URL is required');
    });

    it('should throw error if query is missing', async () => {
      const config: IntegrationNodeData = {
        id: 'graphql_no_query',
        label: 'No Query',
        integrationType: 'graphql',
        url: 'https://api.example.com/graphql'
      };

      await expect(integration.execute(config)).rejects.toThrow('GraphQL query is required');
    });
  });
});

describe('DatabaseIntegration', () => {
  let integration: DatabaseIntegration;

  beforeEach(() => {
    const config: DatabaseConfig = {
      enabled: true,
      knowledgeBase: [
        { title: 'Product A', description: 'Description A', category: 'electronics' },
        { title: 'Product B', description: 'Description B', category: 'clothing' }
      ]
    };
    integration = new DatabaseIntegration(config);
  });

  describe('executeQuery', () => {
    it('should return error if database is disabled', async () => {
      const disabledConfig: DatabaseConfig = {
        enabled: false
      };
      const disabledIntegration = new DatabaseIntegration(disabledConfig);

      const result = await disabledIntegration.executeQuery('SELECT * FROM products');

      expect(result.success).toBe(false);
      expect(result.error).toContain('disabled');
    });

    it('should search knowledge base for SELECT queries', async () => {
      const result = await integration.executeQuery('SELECT * FROM products WHERE title LIKE "Product A"');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    });

    it('should return error for unsupported query types', async () => {
      const result = await integration.executeQuery('INSERT INTO products VALUES (...)');

      expect(result.success).toBe(false);
      expect(result.error).toContain('not fully implemented');
    });

    it('should search by parameters', async () => {
      const result = await integration.executeQuery(
        'SELECT * FROM products WHERE category = :category',
        { category: 'electronics' }
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should handle query errors gracefully', async () => {
      const errorConfig: DatabaseConfig = {
        enabled: true,
        knowledgeBase: null as any
      };
      const errorIntegration = new DatabaseIntegration(errorConfig);

      const result = await errorIntegration.executeQuery('SELECT * FROM products');

      // Should handle gracefully
      expect(result).toBeDefined();
    });
  });
});


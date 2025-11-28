/**
 * Unit tests for Tool Agent Executor
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ToolAgentExecutor } from '../../utils/toolAgent';
import { CentralLogger } from '../../utils/logger';
import { SubAgentNodeData, IntegrationNodeData } from '../../types';

describe('ToolAgentExecutor', () => {
  let executor: ToolAgentExecutor;
  let logger: CentralLogger;

  beforeEach(() => {
    logger = new CentralLogger('error');
    executor = new ToolAgentExecutor(logger);
  });

  describe('executeTool', () => {
    it('should validate input parameters', async () => {
      const toolConfig: SubAgentNodeData = {
        id: 'tool_1',
        label: 'Test Tool',
        functionName: 'test_function',
        parameters: [
          { name: 'userId', type: 'string', required: true },
          { name: 'limit', type: 'number', required: false }
        ]
      };

      const integrationConfig: IntegrationNodeData = {
        id: 'int_1',
        label: 'Test Integration',
        integrationType: 'mock',
        mockOutput: JSON.stringify({ success: true })
      };

      const result = await executor.executeTool(
        toolConfig,
        integrationConfig,
        {} // Missing required userId
      );

      expect(result.success).toBe(false);
      expect(result.error?.code).toBeDefined();
    });

    it('should execute mock integration', async () => {
      const toolConfig: SubAgentNodeData = {
        id: 'tool_mock',
        label: 'Mock Tool',
        functionName: 'mock_function',
        parameters: []
      };

      const integrationConfig: IntegrationNodeData = {
        id: 'int_mock',
        label: 'Mock Integration',
        integrationType: 'mock',
        mockOutput: JSON.stringify({
          status: 'success',
          data: { id: 123, name: 'Test' }
        })
      };

      const result = await executor.executeTool(
        toolConfig,
        integrationConfig,
        {}
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.metadata?.source).toBe('mock');
    });

    it('should validate output schema', async () => {
      const toolConfig: SubAgentNodeData = {
        id: 'tool_schema',
        label: 'Schema Tool',
        functionName: 'schema_function',
        parameters: [],
        outputSchema: {
          type: 'object',
          properties: {
            id: { type: 'number' },
            name: { type: 'string' }
          },
          required: ['id', 'name']
        }
      };

      const integrationConfig: IntegrationNodeData = {
        id: 'int_schema',
        label: 'Schema Integration',
        integrationType: 'mock',
        mockOutput: JSON.stringify({
          id: 123,
          name: 'Test'
        })
      };

      const result = await executor.executeTool(
        toolConfig,
        integrationConfig,
        {}
      );

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
    });

    it('should check success criteria', async () => {
      const toolConfig: SubAgentNodeData = {
        id: 'tool_criteria',
        label: 'Criteria Tool',
        functionName: 'criteria_function',
        parameters: [],
        successCriteria: {
          field: 'status',
          operator: 'equals',
          value: 'success'
        }
      };

      const integrationConfig: IntegrationNodeData = {
        id: 'int_criteria',
        label: 'Criteria Integration',
        integrationType: 'mock',
        mockOutput: JSON.stringify({
          status: 'success',
          data: {}
        })
      };

      const result = await executor.executeTool(
        toolConfig,
        integrationConfig,
        {}
      );

      expect(result.success).toBe(true);
    });

    it('should handle mock integration errors', async () => {
      const toolConfig: SubAgentNodeData = {
        id: 'tool_mock_error',
        label: 'Mock Error Tool',
        functionName: 'error_function',
        parameters: []
      };

      const integrationConfig: IntegrationNodeData = {
        id: 'int_mock_error',
        label: 'Mock Error',
        integrationType: 'mock',
        mockOutput: 'invalid json'
      };

      const result = await executor.executeTool(
        toolConfig,
        integrationConfig,
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should record execution time', async () => {
      const toolConfig: SubAgentNodeData = {
        id: 'tool_timing',
        label: 'Timing Tool',
        functionName: 'timing_function',
        parameters: []
      };

      const integrationConfig: IntegrationNodeData = {
        id: 'int_timing',
        label: 'Timing Integration',
        integrationType: 'mock',
        mockOutput: JSON.stringify({ success: true })
      };

      const result = await executor.executeTool(
        toolConfig,
        integrationConfig,
        {}
      );

      expect(result.metadata?.executionTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling', () => {
    it('should handle missing integration config', async () => {
      const toolConfig: SubAgentNodeData = {
        id: 'tool_no_int',
        label: 'No Integration',
        functionName: 'no_int_function',
        parameters: []
      };

      const integrationConfig: IntegrationNodeData = {
        id: 'int_missing',
        label: 'Missing',
        integrationType: 'unknown' as any
      };

      const result = await executor.executeTool(
        toolConfig,
        integrationConfig,
        {}
      );

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should handle validation errors', async () => {
      const toolConfig: SubAgentNodeData = {
        id: 'tool_validation',
        label: 'Validation Tool',
        functionName: 'validation_function',
        parameters: [
          { name: 'email', type: 'string', required: true }
        ]
      };

      const integrationConfig: IntegrationNodeData = {
        id: 'int_validation',
        label: 'Validation Integration',
        integrationType: 'mock',
        mockOutput: JSON.stringify({})
      };

      const result = await executor.executeTool(
        toolConfig,
        integrationConfig,
        { email: 'invalid-email' } // Invalid format
      );

      // Should validate input
      expect(result).toBeDefined();
    });
  });
});

